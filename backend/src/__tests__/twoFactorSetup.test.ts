import request from 'supertest';
import app from '../app.js';

const mockPoolQuery = jest.fn();

jest.mock('pg', () => {
  const mPool = { query: (...args: any[]) => mockPoolQuery(...args) };
  return { Pool: jest.fn(() => mPool) };
});

jest.mock('../services/rateLimitService.js', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  }),
}));

describe('POST /api/auth/2fa/setup — walletAddress validation', () => {
  it('returns 400 when walletAddress is missing', async () => {
    const res = await request(app).post('/api/auth/2fa/setup').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed (non-Stellar) address', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .send({ walletAddress: 'not-a-stellar-address' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a G-prefixed address that is too short', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .send({ walletAddress: 'GABCDEF' });
    expect(res.status).toBe(400);
  });

  it('proceeds past validation for a well-formed Stellar public key', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const validKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
    const res = await request(app)
      .post('/api/auth/2fa/setup')
      .send({ walletAddress: validKey });

    // 200 means validation passed (DB/QR generation may still fail in test env, so accept 200 or 500)
    expect([200, 500]).toContain(res.status);
    expect(res.status).not.toBe(400);
  });
});
