import express from 'express';
import request from 'supertest';
import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import authRoutes from '../routes/authRoutes.js';
import rateLimitRoutes from '../routes/rateLimitRoutes.js';
import { apiRateLimit } from '../middlewares/rateLimitMiddleware.js';

describe('Rate Limiting Integration', () => {
  const app = express();
  let redis: Redis;

  beforeAll(async () => {
    app.use(express.json());
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    app.use('/auth', authRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/v1/rate-limit', apiRateLimit(), rateLimitRoutes);
    app.use('/api', apiRateLimit(), (_req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });

    if (config.REDIS_URL) {
      redis = new Redis(config.REDIS_URL);
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    if (redis) {
      const keys = await redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  });

  it('should include rate limit headers for API routes', async () => {
    const apiResponse = await request(app).get('/api/v1/rate-limit/tiers');

    expect(apiResponse.status).toBe(200);
    expect(apiResponse.headers).toHaveProperty('x-ratelimit-limit');
    expect(apiResponse.headers).toHaveProperty('x-ratelimit-remaining');
    expect(apiResponse.headers).toHaveProperty('x-ratelimit-reset');
  });

  it('should return available tiers from the public rate limit endpoint', async () => {
    const response = await request(app).get('/api/v1/rate-limit/tiers');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tiers).toHaveProperty('auth');
    expect(response.body.data.tiers).toHaveProperty('api');
    expect(response.body.data.tiers).toHaveProperty('data');
    expect(response.body.data.tiers).toHaveProperty('strict');
  });

  it('should reject invalid rate limit status tiers with a 400', async () => {
    const response = await request(app).get(
      '/api/v1/rate-limit/status?identifier=test-client&tier=invalid'
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid tier');
  });

  it('should return 404/200 but still have headers even if unauthenticated', async () => {
    const response = await request(app).get('/api/non-existent-route');
    // It should hit the middleware before failing with 404 or 401
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
  });

  it('should use different tiers for different routes', async () => {
    const authResponse = await request(app).post('/auth/login');
    const apiResponse = await request(app).get('/api/v1/rate-limit/tiers');

    expect(authResponse.headers['x-ratelimit-limit']).not.toBeUndefined();
    expect(apiResponse.headers['x-ratelimit-limit']).not.toBeUndefined();

    // Auth limit is 10, API limit is 100
    expect(authResponse.headers['x-ratelimit-limit']).toBe('10');
    expect(apiResponse.headers['x-ratelimit-limit']).toBe('100');
  });

  it('should throttle repeated login attempts after the auth limit is reached', async () => {
    let lastResponse;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      lastResponse = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: 'GCXX_TEST_WALLET' });
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.body.error).toBe('Too Many Requests');
    expect(lastResponse?.headers['x-ratelimit-limit']).toBe('10');
    expect(lastResponse?.headers).toHaveProperty('retry-after');
  });
});
