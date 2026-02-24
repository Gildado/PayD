import express from 'express';
import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { Pool } from 'pg';
import { config } from '../config/env';
import jwt from 'jsonwebtoken';

const pool = new Pool({ connectionString: config.DATABASE_URL });

export class AuthController {
    /**
     * POST /api/auth/2fa/setup
     * Generates a structural totp_secret natively mapping `is_2fa_enabled=false`.
     * Evaluates the wallet address binding user boundaries optimally.
     */
    static async setup2fa(req: express.Request, res: express.Response) {
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
    static async verify2fa(req: express.Request, res: express.Response) {
        const { walletAddress, token } = req.body;
        if (!walletAddress || !token) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        try {
            const result = await pool.query('SELECT id, wallet_address, organization_id, role, totp_secret FROM users WHERE wallet_address = $1', [walletAddress]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = result.rows[0];
            const isValid = authenticator.check(token, user.totp_secret);

            if (isValid) {
                await pool.query('UPDATE users SET is_2fa_enabled = true WHERE wallet_address = $1', [walletAddress]);
                
                // Issue tokens upon successful 2FA verification
                const accessToken = jwt.sign(
                    { id: user.id, walletAddress: user.wallet_address, organizationId: user.organization_id, role: user.role },
                    config.JWT_SECRET,
                    { expiresIn: '1h' }
                );
                
                const refreshToken = jwt.sign(
                    { id: user.id },
                    config.JWT_REFRESH_SECRET,
                    { expiresIn: '7d' }
                );
                
                await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

                res.json({ 
                    success: true, 
                    accessToken, 
                    refreshToken,
                    message: '2FA verified successfully' 
                });
            } else {
                res.status(401).json({ error: 'Invalid 2FA token' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/auth/2fa/disable
     * Evaluates valid disabling structures tracking secret clearances parsing structurally exactly avoiding leaks.
     */
    static async disable2fa(req: express.Request, res: express.Response) {
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
    /**
     * POST /api/auth/login
     * Simple wallet-based login. Returns tokens or requires 2FA.
     */
    static async login(req: express.Request, res: express.Response) {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ error: 'Missing walletAddress' });
        }

        try {
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
                    { id: newUser.id, walletAddress: newUser.wallet_address, organizationId: newUser.organization_id, role: newUser.role },
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
                { id: user.id, walletAddress: user.wallet_address, organizationId: user.organization_id, role: user.role },
                config.JWT_SECRET,
                { expiresIn: '1h' }
            );

            const refreshToken = jwt.sign(
                { id: user.id },
                config.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

            await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

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
            return res.status(400).json({ error: 'Missing refresh token' });
        }

        try {
            const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as { id: number };
            const result = await pool.query(
                'SELECT id, wallet_address, organization_id, role, refresh_token FROM users WHERE id = $1', 
                [decoded.id]
            );

            if (result.rows.length === 0 || result.rows[0].refresh_token !== refreshToken) {
                return res.status(401).json({ error: 'Invalid refresh token' });
            }

            const user = result.rows[0];
            const accessToken = jwt.sign(
                { id: user.id, walletAddress: user.wallet_address, organizationId: user.organization_id, role: user.role },
                config.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({ accessToken });
        } catch (error) {
            res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
    }
}
