import request from 'supertest';
import express from 'express';
import { AuthController } from '../authController.js';

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return { default: { Pool: jest.fn(() => mPool) }, Pool: jest.fn(() => mPool) };
});

jest.mock('../../../services/emailVerificationService.js', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue('mock-token'),
  verifyEmailToken: jest.fn(),
}));

jest.mock('../../../services/rateLimitService.js', () => ({
  getRedisClient: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../utils/passwordStrength.js', () => ({
  validatePasswordStrength: jest.fn().mockReturnValue({ valid: true, errors: [], score: 4 }),
}));

jest.mock('../../../middlewares/rateLimitMiddleware.js', () => ({
  authRateLimit: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock('../../../middlewares/auth.js', () => ({
  authenticateJWT: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../services/authService.js', () => ({
  generateToken: jest.fn().mockReturnValue('mock-token'),
}));

jest.mock('../../../config/passport.js', () => ({}));

jest.mock('passport', () => ({
  authenticate: () => (_req: any, _res: any, next: any) => next(),
  use: jest.fn(),
  initialize: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock('../../../controllers/socialAuthController.js', () => ({
  SocialAuthController: {
    listIdentities: jest.fn(),
    unlinkProvider: jest.fn(),
  },
}));

import { sendVerificationEmail, verifyEmailToken } from '../../../services/emailVerificationService.js';
import pg from 'pg';
import { authenticator } from 'otplib';

const app = express();
app.use(express.json());

// Wire up routes directly without importing authRoutes
app.post('/api/auth/register', AuthController.register);
app.get('/api/auth/verify-email', AuthController.verifyEmail);
app.post('/api/auth/resend-verification', AuthController.resendVerification);
app.post('/api/auth/2fa/setup', AuthController.setup2fa);
app.post('/api/auth/2fa/verify', AuthController.verify2fa);
app.post('/api/auth/2fa/disable', AuthController.disable2fa);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/refresh', AuthController.refresh);

describe('Auth Controller', () => {
  let pool: any;

  beforeEach(() => {
    pool = new (pg as any).Pool();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('creates account, sends verification email, and does NOT return a token', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [{ id: 10 }] })
          .mockResolvedValueOnce(undefined),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ organizationName: 'Acme', email: 'test@example.com', password: 'Str0ng!Pass' });

      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.body.message).toMatch(/verify/i);
      expect(sendVerificationEmail).toHaveBeenCalledWith(10, 'test@example.com');
    });

    it('returns 409 when email already exists', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ organizationName: 'Acme', email: 'exists@example.com', password: 'Str0ng!Pass' });

      expect(res.status).toBe(409);
    });

    it('returns 400 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/verify-email', () => {
    it('returns tokens when token is valid', async () => {
      (verifyEmailToken as jest.Mock).mockResolvedValueOnce(10);
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 10, email: 'test@example.com', organization_id: 1, role: 'EMPLOYER' }] })
        .mockResolvedValueOnce({});

      const res = await request(app).get('/api/auth/verify-email?token=validtoken');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('returns 400 when token is missing', async () => {
      const res = await request(app).get('/api/auth/verify-email');
      expect(res.status).toBe(400);
    });

    it('returns 410 when token is expired', async () => {
      const expiredErr = Object.assign(new Error('Verification token has expired.'), { status: 410 });
      (verifyEmailToken as jest.Mock).mockRejectedValueOnce(expiredErr);

      const res = await request(app).get('/api/auth/verify-email?token=expiredtoken');
      expect(res.status).toBe(410);
    });

    it('returns 400 when token is invalid', async () => {
      const invalidErr = Object.assign(new Error('Invalid verification token.'), { status: 400 });
      (verifyEmailToken as jest.Mock).mockRejectedValueOnce(invalidErr);

      const res = await request(app).get('/api/auth/verify-email?token=badtoken');
      expect(res.status).toBe(400);
    });

    it('returns 409 when email already verified', async () => {
      const alreadyErr = Object.assign(new Error('Email is already verified.'), { status: 409 });
      (verifyEmailToken as jest.Mock).mockRejectedValueOnce(alreadyErr);

      const res = await request(app).get('/api/auth/verify-email?token=usedtoken');
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('sends a new email for unverified accounts', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 10, email_verified: false }] });

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(sendVerificationEmail).toHaveBeenCalledWith(10, 'test@example.com');
    });

    it('returns 200 even when email does not exist (prevent enumeration)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('returns 400 when email field is missing', async () => {
      const res = await request(app).post('/api/auth/resend-verification').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/2fa/setup', () => {
    it('generates a secret and returns a QR code', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/auth/2fa/setup')
        .send({ walletAddress: 'GCXX_TEST_WALLET' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('qrCode');
      expect(res.body).toHaveProperty('secret');
      expect(res.body.recoveryCodes).toHaveLength(10);
    });

    it('returns 400 when walletAddress is missing', async () => {
      const res = await request(app).post('/api/auth/2fa/setup').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/2fa/verify', () => {
    it('verifies a valid TOTP token', async () => {
      const secret = authenticator.generateSecret();
      const token = authenticator.generate(secret);

      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, wallet_address: 'GCXX', organization_id: 1, role: 'EMPLOYER', totp_secret: secret }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ walletAddress: 'GCXX', token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 for an invalid TOTP token', async () => {
      const secret = authenticator.generateSecret();

      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ totp_secret: secret }] })
        .mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ walletAddress: 'GCXX', token: '000000' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 403 when wallet is unknown and no invite token is provided', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ locked_until: null }] }) // isLockedOut
        .mockResolvedValueOnce({ rows: [] }); // user lookup (not found)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: 'GUNKNOWN_WALLET' });

      expect(res.status).toBe(403);
      expect(res.body.message ?? res.body.error).toMatch(/invite/i);
    });

    it('returns 403 when wallet is unknown and invite token is invalid', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ locked_until: null }] }) // isLockedOut
        .mockResolvedValueOnce({ rows: [] }) // user lookup (not found)
        .mockResolvedValueOnce({ rows: [] }); // invite lookup (not found)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: 'GUNKNOWN_WALLET', inviteToken: 'bogus-token' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when invite token is already used', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ locked_until: null }] }) // isLockedOut
        .mockResolvedValueOnce({ rows: [] }) // user lookup (not found)
        .mockResolvedValueOnce({
          rows: [{ id: 1, organization_id: 5, role: 'EMPLOYEE', expires_at: new Date(Date.now() + 100000), used_at: new Date() }],
        }); // invite lookup (already used)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: 'GUNKNOWN_WALLET', inviteToken: 'used-token' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when invite token is expired', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ locked_until: null }] }) // isLockedOut
        .mockResolvedValueOnce({ rows: [] }) // user lookup (not found)
        .mockResolvedValueOnce({
          rows: [{ id: 1, organization_id: 5, role: 'EMPLOYEE', expires_at: new Date(Date.now() - 100000), used_at: null }],
        }); // invite lookup (expired)

      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: 'GUNKNOWN_WALLET', inviteToken: 'expired-token' });

      expect(res.status).toBe(403);
    });

    it('creates a new EMPLOYEE account and consumes the invite when token is valid', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ locked_until: null }] }) // isLockedOut
        .mockResolvedValueOnce({ rows: [] }) // user lookup (not found)
        .mockResolvedValueOnce({
          rows: [{ id: 1, organization_id: 5, role: 'EMPLOYEE', expires_at: new Date(Date.now() + 100000), used_at: null }],
        }); // invite lookup (valid)

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 99, wallet_address: 'GNEW_WALLET', organization_id: 5, role: 'EMPLOYEE' }] }) // INSERT user
          .mockResolvedValueOnce(undefined) // UPDATE invites
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: 'GNEW_WALLET', inviteToken: 'valid-token' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invites SET used_at'),
        ['GNEW_WALLET', 1]
      );
    });

    it('logs in an existing user without touching invites', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ locked_until: null }] }) // isLockedOut
        .mockResolvedValueOnce({
          rows: [{ id: 7, wallet_address: 'GEXISTING', organization_id: 5, role: 'EMPLOYEE', is_2fa_enabled: false }],
        }) // user lookup (found)
        .mockResolvedValueOnce(undefined); // refresh_token update

      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: 'GEXISTING' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });
  });

  describe('POST /api/auth/2fa/disable', () => {
    it('disables 2FA with a valid token', async () => {
      const secret = authenticator.generateSecret();
      const token = authenticator.generate(secret);

      pool.query
        .mockResolvedValueOnce({ rows: [{ totp_secret: secret, is_2fa_enabled: true }] })
        .mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ walletAddress: 'GCXX', token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when 2FA is already off', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ totp_secret: 'x', is_2fa_enabled: false }] });

      const res = await request(app)
        .post('/api/auth/2fa/disable')
        .send({ walletAddress: 'GCXX', token: '123456' });

      expect(res.status).toBe(400);
    });
  });
});
