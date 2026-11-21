import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { errorHandlerMiddleware } from '../errorHandlerMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeZodError(): ZodError {
  try {
    z.object({ name: z.string() }).parse({ name: 123 });
  } catch (err) {
    return err as ZodError;
  }
  throw new Error('expected a ZodError');
}

describe('errorHandlerMiddleware', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;
  let req: Request;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
    req = createReq({ method: 'GET', path: '/api/v1/users', originalUrl: '/api/v1/users?x=1' });
  });

  it('renders a ZodError as a 400 problem document', () => {
    errorHandlerMiddleware(makeZodError(), req, res, next);

    expect(res._status).toHaveBeenCalledWith(400);
    expect(res._type).toHaveBeenCalledWith('application/problem+json');
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', status: 400 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('maps an HTTP-tagged error to its status and code', () => {
    const err = Object.assign(new Error('missing'), { status: 404 });

    errorHandlerMiddleware(err, req, res, next);

    expect(res._status).toHaveBeenCalledWith(404);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND', detail: 'missing' })
    );
  });

  it('treats well-known JS errors as 400 bad requests', () => {
    errorHandlerMiddleware(new TypeError('bad input'), req, res, next);

    expect(res._status).toHaveBeenCalledWith(400);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'BAD_REQUEST' })
    );
  });

  it('returns a 500 for unexpected errors', () => {
    errorHandlerMiddleware(new Error('boom'), req, res, next);

    expect(res._status).toHaveBeenCalledWith(500);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' })
    );
  });

  it('hides the error detail in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      errorHandlerMiddleware(new Error('sensitive stack detail'), req, res, next);
      expect(res._json).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'An unexpected error occurred' })
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
