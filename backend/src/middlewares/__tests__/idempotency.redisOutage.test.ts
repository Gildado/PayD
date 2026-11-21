import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import type { IdempotencyService } from '../../services/idempotencyService.js';
import { createIdempotencyMiddleware } from '../idempotency.js';

describe('idempotencyMiddleware storage outage behavior', () => {
  const service: Pick<
    IdempotencyService,
    'getExistingResponse' | 'recordRequest' | 'recordResponse'
  > = {
    getExistingResponse: jest.fn<IdempotencyService['getExistingResponse']>(),
    recordRequest: jest.fn<IdempotencyService['recordRequest']>(),
    recordResponse: jest.fn<IdempotencyService['recordResponse']>(),
  };
  const middleware = createIdempotencyMiddleware({
    serviceProvider: () => service,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails closed without invoking the route when the store is unavailable', async () => {
    service.getExistingResponse.mockRejectedValueOnce(new Error('Store unavailable'));
    const req = {
      get: jest.fn().mockReturnValue('test-idempotency-key'),
      body: { amount: '10' },
    } as unknown as Request;
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Service Unavailable' })
    );
  });

  it('does not send the successful response if storing it fails', async () => {
    service.getExistingResponse.mockResolvedValueOnce(null);
    service.recordRequest.mockResolvedValueOnce({ id: 'record-1', requestHash: 'hash' });
    service.recordResponse.mockRejectedValueOnce(new Error('Store unavailable'));
    const req = {
      get: jest.fn().mockReturnValue('test-idempotency-key'),
      body: { amount: '10' },
    } as unknown as Request;
    const res = createResponse();
    const originalSend = res.send;
    const next = jest.fn() as NextFunction;

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.send('{"success":true}');
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.statusCode).toBe(503);
    expect(originalSend).toHaveBeenCalledWith(
      JSON.stringify({
        error: 'Service Unavailable',
        message: 'Idempotency storage is temporarily unavailable.',
      })
    );
  });
});

function createResponse(): Response {
  const response = {
    statusCode: 200,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: jest.fn(function (this: Response) {
      return this;
    }),
    send: jest.fn(function (this: Response) {
      return this;
    }),
    setHeader: jest.fn(),
  };
  return response as unknown as Response;
}
