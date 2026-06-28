import { asyncHandler } from '../asyncHandler.js';
import { Request, Response, NextFunction } from 'express';

describe('asyncHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('calls the wrapped function normally when it resolves', async () => {
    const handler = asyncHandler(async (_req, res, _next) => {
      res.status(200).json({ ok: true });
    });

    await handler(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next() when the handler throws', async () => {
    const error = new Error('Something broke');
    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('forwards rejected promises to next()', async () => {
    const error = new Error('Promise rejected');
    const handler = asyncHandler(async () => {
      return Promise.reject(error);
    });

    handler(req as Request, res as Response, next);
    await new Promise(process.nextTick);

    expect(next).toHaveBeenCalledWith(error);
  });
});
