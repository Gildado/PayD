import { NextFunction, Request, Response } from 'express';
import { checkTenantRateLimit } from '../../services/tenantRateLimitService.js';
import { tenantRateLimit } from '../tenantRateLimitMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/tenantRateLimitService', () => ({
  checkTenantRateLimit: jest.fn(),
}));

const mockCheck = checkTenantRateLimit as jest.Mock;

describe('tenantRateLimit', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;
  const resetAt = new Date('2026-11-21T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('skips rate limiting when no organization is present', async () => {
    await tenantRateLimit()(createReq({}), res, next);

    expect(mockCheck).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('sets rate-limit headers and calls next when allowed', async () => {
    mockCheck.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAt,
      plan: 'pro',
    });
    const req = createReq({ user: { id: 1, organizationId: 7, role: 'EMPLOYER' } });

    await tenantRateLimit()(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Plan', 'pro');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('returns 429 with a Retry-After header when the limit is exceeded', async () => {
    mockCheck.mockResolvedValue({
      allowed: false,
      limit: 100,
      remaining: 0,
      resetAt,
      plan: 'free',
      retryAfter: 42,
    });
    const req = createReq({ user: { id: 1, organizationId: 7, role: 'EMPLOYER' } });

    await tenantRateLimit()(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 42);
    expect(res._status).toHaveBeenCalledWith(429);
    expect(res._json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });
});
