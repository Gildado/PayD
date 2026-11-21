import type { NextFunction, Request, Response } from 'express';
import { authenticator } from 'otplib';
import { pool } from '../config/database.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

interface UserTwoFactorRow {
  is_2fa_enabled: boolean;
  totp_secret: string | null;
  recovery_codes: string[] | null;
}

type TwoFactorIdentity = 'userId' | 'walletAddress';

export interface Require2FAOptions {
  /** Skip verification when the guarded request condition is false. */
  when?: (req: Request) => boolean;
  /** Require setup instead of allowing accounts without 2FA to proceed. */
  requireEnabled?: boolean;
  /** Use the authenticated user id or resolve a wallet address from request data. */
  identity?: TwoFactorIdentity;
}

/**
 * Configurable 2FA gate used by payment, wallet-update, and admin routes.
 * Recovery codes are consumed once; TOTP is checked when no recovery code matches.
 */
export function require2FA(options: Require2FAOptions = {}) {
  const { when, requireEnabled = false, identity = 'walletAddress' } = options;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (when && !when(req)) {
      next();
      return;
    }

    const subject = identity === 'userId'
      ? req.user?.id
      : req.user?.walletAddress || req.headers['x-user-wallet'] || req.body?.walletAddress || req.body?.senderPublicKey;
    if (!subject) {
      if (requireEnabled) {
        res.status(401).json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Authentication required for admin actions'));
      } else {
        res.status(400).json({ error: 'Wallet address required for 2FA (JWT user or senderPublicKey)' });
      }
      return;
    }

    const selector = identity === 'userId' ? 'id' : 'wallet_address';
    const token = String(req.headers['x-2fa-token'] || req.body?.twoFactorToken || '').trim();
    try {
      const result = await pool.query<UserTwoFactorRow>(
        `SELECT is_2fa_enabled, totp_secret, recovery_codes FROM users WHERE ${selector} = $1`,
        [subject]
      );
      const user = result.rows[0];
      if (!user || !user.is_2fa_enabled || !user.totp_secret) {
        if (!requireEnabled && (!user || !user.is_2fa_enabled)) {
          next();
          return;
        }
        res.status(403).json(apiErrorResponse(
          ErrorCodes.FORBIDDEN,
          'Two-factor authentication must be enabled to manage organization settings'
        ));
        return;
      }

      if (!token) {
        if (requireEnabled) {
          res.status(401).json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'A 2FA token or recovery code is required for this action'));
        } else {
          res.status(401).json({ error: '2FA token or recovery code required' });
        }
        return;
      }

      const codes = Array.isArray(user.recovery_codes) ? user.recovery_codes : [];
      const codeIndex = codes.findIndex((code) => String(code).toLowerCase() === token.toLowerCase());
      if (codeIndex >= 0) {
        const remaining = codes.filter((_, index) => index !== codeIndex);
        await pool.query(`UPDATE users SET recovery_codes = $1 WHERE ${selector} = $2`, [remaining, subject]);
        next();
        return;
      }

      if (authenticator.check(token, user.totp_secret)) {
        next();
        return;
      }

      if (requireEnabled) {
        res.status(401).json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid 2FA token or recovery code'));
      } else {
        res.status(401).json({ error: 'Invalid 2FA token or recovery code' });
      }
    } catch (error) {
      if (requireEnabled) {
        console.error('[require2FA]', error);
        res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to verify two-factor authentication'));
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to verify 2FA' });
      }
    }
  };
}

export const require2FAIfWalletUpdate = require2FA({
  when: (req) => Object.prototype.hasOwnProperty.call(req.body ?? {}, 'wallet_address'),
});
