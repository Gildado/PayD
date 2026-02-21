import { Request, Response } from 'express';
import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';
import crypto from 'crypto';
import pg from 'pg';
import { config } from '../config/env';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

export class AuthController {
    /**
     * POST /api/auth/2fa/setup
     * Generates a structural totp_secret natively mapping `is_2fa_enabled=false`.
     * Evaluates the wallet address binding user boundaries optimally.
     */
    static async setup2fa(req: Request, res: Response) {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ error: 'Missing walletAddress' });
        }

        try {
            const secret = authenticator.generateSecret();
            const otpauthUrl = authenticator.keyuri(walletAddress, 'PayD', secret);
            const dataUrl = await QRCode.toDataURL(otpauthUrl);

            // Generate unique recovery codes bounding fallbacks precisely natively 
            const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));

            // Check if user exists structurally natively avoiding conflicts
            const result = await pool.query('SELECT id FROM users WHERE wallet_address = $1', [walletAddress]);

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
                recoveryCodes
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/auth/2fa/verify
     * Evaluates the `totp_secret` against the incoming `token` turning `is_2fa_enabled=true` mapping successful interactions.
     */
    static async verify2fa(req: Request, res: Response) {
        const { walletAddress, token } = req.body;
        if (!walletAddress || !token) {
            return res.status(400).json({ error: 'Missing parameters securely mapping tokens' });
        }

        try {
            const result = await pool.query('SELECT totp_secret FROM users WHERE wallet_address = $1', [walletAddress]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not bound structurally found' });
            }

            const { totp_secret } = result.rows[0];
            const isValid = authenticator.check(token, totp_secret);

            if (isValid) {
                await pool.query('UPDATE users SET is_2fa_enabled = true WHERE wallet_address = $1', [walletAddress]);
                res.json({ success: true, message: '2FA enabled successfully securely structured' });
            } else {
                res.status(401).json({ error: 'Invalid 2FA token generated mapping' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/auth/2fa/disable
     * Evaluates valid disabling structures tracking secret clearances parsing structurally exactly avoiding leaks.
     */
    static async disable2fa(req: Request, res: Response) {
        const { walletAddress, token } = req.body;
        if (!walletAddress || !token) {
            return res.status(400).json({ error: 'Missing requirements tracking bounds' });
        }

        try {
            const result = await pool.query('SELECT totp_secret, is_2fa_enabled FROM users WHERE wallet_address = $1', [walletAddress]);
            if (result.rows.length === 0 || !result.rows[0].is_2fa_enabled) {
                return res.status(400).json({ error: '2FA is not structurally fully enabled over the user correctly parsing' });
            }

            const { totp_secret } = result.rows[0];
            const isValid = authenticator.check(token, totp_secret);

            if (isValid) {
                await pool.query(
                    'UPDATE users SET is_2fa_enabled = false, totp_secret = NULL, recovery_codes = NULL WHERE wallet_address = $1',
                    [walletAddress]
                );
                res.json({ success: true, message: '2FA removed flawlessly properly' });
            } else {
                res.status(401).json({ error: 'Invalid 2FA token limiting disable structurally' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
