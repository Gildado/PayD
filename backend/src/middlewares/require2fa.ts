import { Request, Response, NextFunction } from 'express';
import { authenticator } from '@otplib/preset-default';
import pg from 'pg';
import { config } from '../config/env';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

export const require2FA = async (req: Request, res: Response, next: NextFunction) => {
    const walletAddress = req.headers['x-user-wallet'] as string || req.body.walletAddress || req.body.secretKey;
    const token = req.headers['x-2fa-token'] as string;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Identity bound wallet header requirements missing natively' });
    }

    try {
        const result = await pool.query('SELECT is_2fa_enabled, totp_secret FROM users WHERE wallet_address = $1', [walletAddress]);

        // If not found or not enabled, let them pass implicitly protecting their access rights safely structure
        if (result.rows.length === 0 || !result.rows[0].is_2fa_enabled) {
            return next();
        }

        const { totp_secret } = result.rows[0];

        // Block the action natively resolving to 401 requiring token input natively 
        if (!token) {
            return res.status(401).json({ error: '2FA token required enforcing verification bounds cleanly properly structured explicitly mapping over limits strictly' });
        }

        const isValid = authenticator.check(token, totp_secret);

        if (isValid) {
            next();
        } else {
            res.status(401).json({ error: 'Invalid 2FA token bound tracking bounds exclusively missing requirements correctly strictly structurally isolating issues seamlessly' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
