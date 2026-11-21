import { NextFunction, Request, Response } from 'express';
import { ThrottlingService } from '../../services/throttlingService.js';
import { requireThrottling, throttlingMiddleware } from '../throttlingMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/throttlingService', () => ({
  ThrottlingService: { getInstance: jest.fn() },
}));

interface ServiceMock {
  hasCapacity: jest.Mock;
  getStatus: jest.Mock;
  submit: jest.Mock;
  emit: jest.Mock;
}

describe('throttlingMiddleware', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;
  let service: ServiceMock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = {
      hasCapacity: jest.fn(() => true),
      getStatus: jest.fn(() => ({ tpm: 600, currentTokens: 599, queueSize: 0 })),
      submit: jest.fn(async (_id, fn) => fn()),
      emit: jest.fn(),
    };
    (ThrottlingService.getInstance as jest.Mock).mockReturnValue(service);
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('skips throttling when the skip condition is true', async () => {
    await throttlingMiddleware({ skipCondition: () => true })(createReq({}), res, next);

    expect(service.hasCapacity).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when the service has no capacity (failure path)', async () => {
    service.hasCapacity.mockReturnValue(false);
    service.getStatus.mockReturnValue({ tpm: 60, currentTokens: 0, queueSize: 30 });

    await throttlingMiddleware()(createReq({}), res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-QueueSize', '30');
    expect(res._status).toHaveBeenCalledWith(429);
    expect(res._json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Too Many Requests' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches a throttling context and calls next when capacity exists (success path)', async () => {
    const req = createReq({ headers: { 'x-priority': 'high' } });

    await throttlingMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const ctx = (req as Request & { throttlingContext?: { isPriority: boolean } }).throttlingContext;
    expect(ctx?.isPriority).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '600');
  });

  it('requireThrottling rejects without context and delegates with context', async () => {
    await expect(requireThrottling(createReq({}), async () => 'x')).rejects.toThrow(
      'Throttling context not found'
    );

    const req = createReq({});
    await throttlingMiddleware()(req, res, next);
    const result = await requireThrottling(req, async () => 'done');

    expect(result).toBe('done');
    expect(service.submit).toHaveBeenCalled();
  });
});
