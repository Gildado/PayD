import { NextFunction, Request, Response } from 'express';
import { getIdempotencyService } from '../../services/idempotencyService.js';
import { idempotencyMiddleware } from '../idempotency.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/idempotencyService', () => ({
  getIdempotencyService: jest.fn(() => ({
    getExistingResponse: jest.fn(),
    recordRequest: jest.fn(),
    recordResponse: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const KEY = 'key-123';

interface ServiceMocks {
  getExistingResponse: jest.Mock;
  recordRequest: jest.Mock;
  recordResponse: jest.Mock;
}

describe('idempotencyMiddleware (legacy)', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;
  let svc: ServiceMocks;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish the factory result after clearAllMocks wipes mock.results.
    (getIdempotencyService as jest.Mock).mockImplementation(() => ({
      getExistingResponse: jest.fn(),
      recordRequest: jest.fn(),
      recordResponse: jest.fn().mockResolvedValue(undefined),
    }));
    svc = {
      getExistingResponse: jest.fn(),
      recordRequest: jest.fn(),
      recordResponse: jest.fn().mockResolvedValue(undefined),
    };
    (getIdempotencyService as jest.Mock).mockReturnValue(svc);
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('passes through when no idempotency key is supplied', async () => {
    await idempotencyMiddleware(createReq({ headers: {} }), res, next);

    expect(getIdempotencyService).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns the cached JSON response for a completed key', async () => {
    svc.getExistingResponse.mockResolvedValue({
      response_status: 200,
      response_body: '{"cached":true}',
    });
    const req = createReq({ headers: { 'idempotency-key': KEY } });

    await idempotencyMiddleware(req, res, next);

    expect(res._status).toHaveBeenCalledWith(200);
    expect(res._json).toHaveBeenCalledWith({ cached: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('records the request and stores the response on a new key', async () => {
    svc.getExistingResponse.mockResolvedValue(null);
    svc.recordRequest.mockResolvedValue({ id: 'rec-1' });
    const req = createReq({ headers: { 'idempotency-key': KEY }, body: { amount: 5 } });

    await idempotencyMiddleware(req, res, next);

    expect(svc.recordRequest).toHaveBeenCalledWith(KEY, { amount: 5 }, undefined);
    expect((req as Request & { idempotencyKey?: string }).idempotencyKey).toBe(KEY);
    expect(next).toHaveBeenCalledTimes(1);

    res.json({ ok: true });
    expect(svc.recordResponse).toHaveBeenCalledWith('rec-1', { ok: true }, 200);
  });

  it('fails open by calling next when the service throws', async () => {
    svc.getExistingResponse.mockRejectedValue(new Error('db down'));
    const req = createReq({ headers: { 'idempotency-key': KEY } });

    await idempotencyMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });
});
