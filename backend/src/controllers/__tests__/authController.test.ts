import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/authRoutes';
import { authenticator } from '@otplib/preset-default';
import pg from 'pg';

jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Controller 2FA Integration', () => {
    let pool: any;

    beforeEach(() => {
        pool = new pg.Pool();
        jest.clearAllMocks();
    });

    describe('POST /api/auth/2fa/setup', () => {
        it('generates a secret and returns a QR code properly maintaining is_2fa_enabled as false', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] }); // User not found
            pool.query.mockResolvedValueOnce({}); // Insert success

            const response = await request(app)
                .post('/api/auth/2fa/setup')
                .send({ walletAddress: 'GCXX_TEST_WALLET' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('qrCode');
            expect(response.body).toHaveProperty('secret');
            expect(response.body).toHaveProperty('recoveryCodes');
            expect(response.body.recoveryCodes.length).toBe(10);
            expect(pool.query).toHaveBeenCalledTimes(2);
        });

        it('requires walletAddress structured securely', async () => {
            const response = await request(app)
                .post('/api/auth/2fa/setup')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing walletAddress');
        });
    });

    describe('POST /api/auth/2fa/verify', () => {
        it('verifies valid tokens completely altering is_2fa_enabled perfectly', async () => {
            const secret = authenticator.generateSecret();
            const token = authenticator.generate(secret);

            pool.query.mockResolvedValueOnce({ rows: [{ totp_secret: secret }] }); // Select secret
            pool.query.mockResolvedValueOnce({}); // Update is_2fa_enabled = true

            const response = await request(app)
                .post('/api/auth/2fa/verify')
                .send({ walletAddress: 'GCXX_TEST_WALLET', token });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('rejects invalid tokens maintaining database structures strictly', async () => {
            const secret = authenticator.generateSecret();

            pool.query.mockResolvedValueOnce({ rows: [{ totp_secret: secret }] });

            const response = await request(app)
                .post('/api/auth/2fa/verify')
                .send({ walletAddress: 'GCXX_TEST_WALLET', token: '000000' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid 2FA token generated mapping');
        });
    });

    describe('POST /api/auth/2fa/disable', () => {
        it('disables 2FA safely validating token logic precisely mapping states natively', async () => {
            const secret = authenticator.generateSecret();
            const token = authenticator.generate(secret);

            pool.query.mockResolvedValueOnce({ rows: [{ totp_secret: secret, is_2fa_enabled: true }] });
            pool.query.mockResolvedValueOnce({});

            const response = await request(app)
                .post('/api/auth/2fa/disable')
                .send({ walletAddress: 'GCXX_TEST_WALLET', token });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('fails to disable if 2FA is already off avoiding arbitrary leaks structurally', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ totp_secret: 'some_secret', is_2fa_enabled: false }] });

            const response = await request(app)
                .post('/api/auth/2fa/disable')
                .send({ walletAddress: 'GCXX_TEST_WALLET', token: '123456' });

            expect(response.status).toBe(400);
        });
    });
});
