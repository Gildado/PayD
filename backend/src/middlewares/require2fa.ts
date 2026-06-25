import { Request, Response, NextFunction } from 'express';
import { authenticator } from 'otplib';
import pg from 'pg';
import { config } from '../config/env.js';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

export const require2FA = async (req: Request, res: Response, next: NextFunction) => {
  const walletAddress =
    req.user?.walletAddress ||
    (req.headers['x-user-wallet'] as string) ||
    req.body.walletAddress ||
    req.body.senderPublicKey;
  const token = ((req.headers['x-2fa-token'] as string) || req.body.twoFactorToken || '').trim();

  if (!walletAddress) {
    return res
      .status(400)
      .json({ error: 'Wallet address required for 2FA (JWT user or senderPublicKey)' });
  }

  try {
    const result = await pool.query(
      'SELECT is_2fa_enabled, totp_secret, recovery_codes FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (result.rows.length === 0 || !result.rows[0].is_2fa_enabled) {
      return next();
    }

    const { totp_secret, recovery_codes } = result.rows[0];

    if (!token) {
      return res.status(401).json({ error: '2FA token or recovery code required' });
    }

    let codes: string[] = Array.isArray(recovery_codes) ? recovery_codes : [];
    const codeIdx = codes.findIndex((c) => String(c).toLowerCase() === token.toLowerCase());
    if (codeIdx >= 0) {
      codes = codes.filter((_, i) => i !== codeIdx);
      await pool.query('UPDATE users SET recovery_codes = $1 WHERE wallet_address = $2', [
        codes,
        walletAddress,
      ]);
      return next();
    }

    const isValid = authenticator.check(token, totp_secret);

    if (isValid) {
      next();
    } else {
      res.status(401).json({ error: 'Invalid 2FA token or recovery code' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
