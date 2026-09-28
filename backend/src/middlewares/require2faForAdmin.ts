/**
 * require2FAForAdmin
 *
 * Enforces verified TOTP / recovery-code two-factor authentication on sensitive
 * admin organization-management endpoints (e.g. renaming an organization or
 * rotating its Stellar issuer account).
 *
 * Unlike `require2FA`, which is a *soft* gate that lets a request through when
 * the user has not enabled 2FA, this middleware is a *hard* gate:
 *
 *   1. The request must carry an authenticated user (JWT) — run after
 *      `authenticateJWT`.
 *   2. The user MUST have 2FA enabled. Admins managing an organization are
 *      required to protect their account, so a missing/disabled 2FA setup is
 *      rejected with `403 FORBIDDEN`.
 *   3. A valid TOTP token (or single-use recovery code) MUST be supplied via the
 *      `x-2fa-token` header or the `twoFactorToken` body field.
 *
 * Recovery codes are single-use and consumed on a successful match.
 */

import { Request, Response, NextFunction } from 'express';
import { authenticator } from 'otplib';
import { pool } from '../config/database.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

interface UserTwoFactorRow {
  is_2fa_enabled: boolean;
  totp_secret: string | null;
  recovery_codes: string[] | null;
}

export const require2FAForAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) {
    return res
      .status(401)
      .json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Authentication required for admin actions'));
  }

  const token = ((req.headers['x-2fa-token'] as string) || req.body?.twoFactorToken || '').trim();

  try {
    const result = await pool.query<UserTwoFactorRow>(
      'SELECT is_2fa_enabled, totp_secret, recovery_codes FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    // Hard gate: 2FA must be set up before performing admin org operations.
    if (!user || !user.is_2fa_enabled || !user.totp_secret) {
      return res
        .status(403)
        .json(
          apiErrorResponse(
            ErrorCodes.FORBIDDEN,
            'Two-factor authentication must be enabled to manage organization settings'
          )
        );
    }

    if (!token) {
      return res
        .status(401)
        .json(
          apiErrorResponse(
            ErrorCodes.UNAUTHORIZED,
            'A 2FA token or recovery code is required for this action'
          )
        );
    }

    // 1. Try single-use recovery codes (case-insensitive match).
    const codes: string[] = Array.isArray(user.recovery_codes) ? user.recovery_codes : [];
    const codeIdx = codes.findIndex((c) => String(c).toLowerCase() === token.toLowerCase());

    if (codeIdx >= 0) {
      const remaining = codes.filter((_, i) => i !== codeIdx);
      await pool.query('UPDATE users SET recovery_codes = $1 WHERE id = $2', [remaining, userId]);
      return next();
    }

    // 2. Fall back to a time-based one-time password.
    if (authenticator.check(token, user.totp_secret)) {
      return next();
    }

    return res
      .status(401)
      .json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid 2FA token or recovery code'));
  } catch (err) {
    console.error('[require2FAForAdmin]', err);
    return res
      .status(500)
      .json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to verify two-factor authentication'));
  }
};

export default require2FAForAdmin;
