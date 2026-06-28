import express from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { Pool } from 'pg';
import { config } from '../config/env.js';
import jwt from 'jsonwebtoken';
import { validatePasswordStrength } from '../utils/passwordStrength.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import { getRedisClient } from '../services/rateLimitService.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes

async function recordFailedAttempt(walletAddress: string): Promise<void> {
  const redis = getRedisClient();
  const key = `login:failures:${walletAddress}`;
  if (redis) {
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, LOCKOUT_SECONDS);
  } else {
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= $1
               THEN NOW() + INTERVAL '${LOCKOUT_SECONDS} seconds'
             ELSE locked_until
           END
       WHERE wallet_address = $2`,
      [MAX_FAILED_ATTEMPTS, walletAddress]
    );
  }
}

async function clearFailedAttempts(walletAddress: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.del(`login:failures:${walletAddress}`);
  } else {
    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE wallet_address = $1`,
      [walletAddress]
    );
  }
}

async function isLockedOut(walletAddress: string): Promise<{ locked: boolean; retryAfter?: number }> {
  const redis = getRedisClient();
  if (redis) {
    const key = `login:failures:${walletAddress}`;
    const attempts = parseInt((await redis.get(key)) ?? '0', 10);
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      return { locked: true, retryAfter: ttl > 0 ? ttl : LOCKOUT_SECONDS };
    }
    return { locked: false };
  }
  const result = await pool.query(
    `SELECT locked_until FROM users WHERE wallet_address = $1`,
    [walletAddress]
  );
  const lockedUntil: Date | null = result.rows[0]?.locked_until ?? null;
  if (lockedUntil && lockedUntil > new Date()) {
    return { locked: true, retryAfter: Math.ceil((lockedUntil.getTime() - Date.now()) / 1000) };
  }
  return { locked: false };
}

export class AuthController {
  /**
   * POST /api/auth/register
   *
   * Creates a new organization and its first admin (EMPLOYER) user.
   * Enforces minimum password complexity before persisting anything.
   *
   * Request body:
   *   { organizationName, email, password }
   *
   * Response (201):
   *   { message, organizationId, accessToken, refreshToken }
   */
  static async register(req: express.Request, res: express.Response) {
    const { organizationName, email, password } = req.body as {
      organizationName?: string;
      email?: string;
      password?: string;
    };

    if (!organizationName || !email || !password) {
      return res.status(400).json(
        apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: organizationName, email, password.')
      );
    }

    const emailNorm = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Invalid email address.'));
    }

    // ── Password strength check ─────────────────────────────────────────────
    const strength = validatePasswordStrength(password, emailNorm);
    if (!strength.valid) {
      return res.status(422).json({
        ...apiErrorResponse(ErrorCodes.UNPROCESSABLE, 'Password does not meet complexity requirements.', strength.errors),
        score: strength.score,
      });
    }

    try {
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
      if (existingUser.rows.length > 0) {
        return res
          .status(409)
          .json(apiErrorResponse(ErrorCodes.CONFLICT, 'An account with this email already exists.'));
      }

      // Hash the password before storing (bcrypt-equivalent; using scrypt here to
      // avoid adding a new dependency when crypto is already imported).
      const salt = crypto.randomBytes(16).toString('hex');
      const hashBuf = await new Promise<Buffer>((resolve, reject) =>
        crypto.scrypt(password, salt, 64, (err, buf) => (err ? reject(err) : resolve(buf)))
      );
      const passwordHash = `${salt}:${hashBuf.toString('hex')}`;

      // Create organization and admin user inside a single transaction.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const orgResult = await client.query(
          `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
          [organizationName.trim()]
        );
        const organizationId: number = orgResult.rows[0].id;

        const userResult = await client.query(
          `INSERT INTO users (email, password_hash, organization_id, role)
           VALUES ($1, $2, $3, 'EMPLOYER')
           RETURNING id`,
          [emailNorm, passwordHash, organizationId]
        );
        const userId: number = userResult.rows[0].id;

        await client.query('COMMIT');

        const accessToken = jwt.sign(
          { id: userId, email: emailNorm, organizationId, role: 'EMPLOYER' },
          config.JWT_SECRET,
          { expiresIn: '1h' }
        );
        const refreshToken = jwt.sign({ id: userId }, config.JWT_REFRESH_SECRET, {
          expiresIn: '7d',
        });

        await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
          refreshToken,
          userId,
        ]);

        return res.status(201).json({
          message: 'Organization and admin account created successfully.',
          organizationId,
          accessToken,
          refreshToken,
        });
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } catch (error: any) {
      return res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }
  /**
   * POST /api/auth/2fa/setup
   * Generates a structural totp_secret natively mapping `is_2fa_enabled=false`.
   * Evaluates the wallet address binding user boundaries optimally.
   */
  static async setup2fa(req: express.Request, res: express.Response) {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Missing walletAddress'));
    }

    try {
      const secret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(walletAddress, 'PayD', secret);
      const dataUrl = await QRCode.toDataURL(otpauthUrl);

      // Generate unique recovery codes bounding fallbacks precisely natively
      const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));

      // Check if user exists structurally natively avoiding conflicts
      const result = await pool.query('SELECT id FROM users WHERE wallet_address = $1', [
        walletAddress,
      ]);

      if (result.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (wallet_address, totp_secret, recovery_codes, is_2fa_enabled) 
           VALUES ($1, $2, $3, false)`,
          [walletAddress, secret, recoveryCodes]
        );
      } else {
        await pool.query(
          `UPDATE users SET totp_secret = $1, recovery_codes = $2, is_2fa_enabled = false
           WHERE wallet_address = $3`,
          [secret, recoveryCodes, walletAddress]
        );
      }

      res.json({
        qrCode: dataUrl,
        secret,
        recoveryCodes,
      });
    } catch (error: any) {
      res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }

  /**
   * POST /api/auth/2fa/verify
   * Evaluates the `totp_secret` against the incoming `token` turning `is_2fa_enabled=true` mapping successful interactions.
   */
  static async verify2fa(req: express.Request, res: express.Response) {
    const { walletAddress, token } = req.body;
    if (!walletAddress || !token) {
      return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Missing parameters'));
    }

    try {
      const lockout = await isLockedOut(walletAddress);
      if (lockout.locked) {
        return res.status(429).json({
          ...apiErrorResponse(ErrorCodes.TOO_MANY_REQUESTS ?? 'TOO_MANY_REQUESTS', 'Account temporarily locked due to too many failed attempts.'),
          retryAfter: lockout.retryAfter,
        });
      }

      const result = await pool.query(
        'SELECT id, wallet_address, organization_id, role, totp_secret FROM users WHERE wallet_address = $1',
        [walletAddress]
      );
      if (result.rows.length === 0) {
        return res.status(404).json(apiErrorResponse(ErrorCodes.NOT_FOUND, 'User not found'));
      }

      const user = result.rows[0];
      const isValid = authenticator.check(token, user.totp_secret);

      if (isValid) {
        await clearFailedAttempts(walletAddress);
        await pool.query('UPDATE users SET is_2fa_enabled = true WHERE wallet_address = $1', [
          walletAddress,
        ]);

        const accessToken = jwt.sign(
          {
            id: user.id,
            walletAddress: user.wallet_address,
            email: '',
            organizationId: user.organization_id,
            role: user.role,
          },
          config.JWT_SECRET,
          { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign({ id: user.id }, config.JWT_REFRESH_SECRET, {
          expiresIn: '7d',
        });

        await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
          refreshToken,
          user.id,
        ]);

        res.json({
          success: true,
          accessToken,
          refreshToken,
          message: '2FA verified successfully',
        });
      } else {
        await recordFailedAttempt(walletAddress);
        res.status(401).json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid 2FA token'));
      }
    } catch (error: any) {
      res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }

  /**
   * POST /api/auth/2fa/disable
   * Evaluates valid disabling structures tracking secret clearances parsing structurally exactly avoiding leaks.
   */
  static async disable2fa(req: express.Request, res: express.Response) {
    const { walletAddress, token } = req.body;
    if (!walletAddress || !token) {
      return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: walletAddress, token'));
    }

    try {
      const result = await pool.query(
        'SELECT totp_secret, is_2fa_enabled FROM users WHERE wallet_address = $1',
        [walletAddress]
      );
      if (result.rows.length === 0 || !result.rows[0].is_2fa_enabled) {
        return res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.BAD_REQUEST, '2FA is not enabled for this user'));
      }

      const { totp_secret } = result.rows[0];
      const isValid = authenticator.check(token, totp_secret);

      if (isValid) {
        await pool.query(
          'UPDATE users SET is_2fa_enabled = false, totp_secret = NULL, recovery_codes = NULL WHERE wallet_address = $1',
          [walletAddress]
        );
        res.json({ success: true, message: '2FA disabled successfully' });
      } else {
        res.status(401).json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid 2FA token'));
      }
    } catch (error: any) {
      res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, error.message));
    }
  }
  /**
   * POST /api/auth/login
   * Simple wallet-based login. Returns tokens or requires 2FA.
   */
  static async login(req: express.Request, res: express.Response) {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Missing walletAddress'));
    }

    try {
      const lockout = await isLockedOut(walletAddress);
      if (lockout.locked) {
        return res.status(429).json({
          ...apiErrorResponse(ErrorCodes.TOO_MANY_REQUESTS ?? 'TOO_MANY_REQUESTS', 'Account temporarily locked due to too many failed attempts.'),
          retryAfter: lockout.retryAfter,
        });
      }

      const result = await pool.query(
        'SELECT id, wallet_address, organization_id, role, is_2fa_enabled FROM users WHERE wallet_address = $1',
        [walletAddress]
      );

      if (result.rows.length === 0) {
        // For demo purposes, auto-register as EMPLOYEE if not found
        // In production, this would be a separate registration flow
        const insertResult = await pool.query(
          'INSERT INTO users (wallet_address, role) VALUES ($1, $2) RETURNING *',
          [walletAddress, 'EMPLOYEE']
        );
        const newUser = insertResult.rows[0];
        const accessToken = jwt.sign(
          {
            id: newUser.id,
            walletAddress: newUser.wallet_address,
            email: '',
            organizationId: newUser.organization_id,
            role: newUser.role,
          },
          config.JWT_SECRET,
          { expiresIn: '1h' }
        );
        return res.json({ accessToken });
      }

      const user = result.rows[0];
      if (user.is_2fa_enabled) {
        return res.json({ requires2fa: true });
      }

      const accessToken = jwt.sign(
        {
          id: user.id,
          walletAddress: user.wallet_address,
          organizationId: user.organization_id,
          role: user.role,
        },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign({ id: user.id }, config.JWT_REFRESH_SECRET, {
        expiresIn: '7d',
      });

      await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
        refreshToken,
        user.id,
      ]);

      res.json({ accessToken, refreshToken });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/auth/refresh
   * Refreshes access token using a valid refresh token.
   */
  static async refresh(req: express.Request, res: express.Response) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Missing refresh token'));
    }

    try {
      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as { id: number };
      const result = await pool.query(
        'SELECT id, wallet_address, organization_id, role, refresh_token FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0 || result.rows[0].refresh_token !== refreshToken) {
        return res.status(401).json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid refresh token'));
      }

      const user = result.rows[0];
      const accessToken = jwt.sign(
        {
          id: user.id,
          walletAddress: user.wallet_address,
          email: '',
          organizationId: user.organization_id,
          role: user.role,
        },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ accessToken });
    } catch (error) {
      res.status(401).json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid or expired refresh token'));
    }
  }
}
