import { NextFunction, Request, Response } from 'express';
import { rateLimitService } from '../../services/rateLimitService.js';
import { rateLimitMiddleware } from '../rateLimitMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/rateLimitService', () => ({
  rateLimitService: {
    getTierConfig: jest.fn(() => ({ windowMs: 60_000 })),
    checkRateLimit: jest.fn(),
  },
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCheck = rateLimitService.checkRateLimit as jest.Mock;

describe('rateLimitMiddleware', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;
  const resetAt = new Date('2026-11-21T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('sets rate-limit headers and calls next when the request is allowed', async () => {
    mockCheck.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAt,
      retryAfter: 0,
    });

    await rateLimitMiddleware()(createReq({ ip: '10.0.0.1' }), res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mockCheck.mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt,
      retryAfter: 30,
    });

    await rateLimitMiddleware()(createReq({ ip: '10.0.0.2' }), res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 30);
    expect(res._status).toHaveBeenCalledWith(429);
    expect(res._json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Too Many Requests' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('honours the skip option without checking the limit', async () => {
    await rateLimitMiddleware({ skip: () => true })(createReq({}), res, next);

    expect(mockCheck).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails open by calling next when the rate-limit check throws', async () => {
    mockCheck.mockRejectedValue(new Error('redis down'));

    await rateLimitMiddleware()(createReq({}), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });
});
