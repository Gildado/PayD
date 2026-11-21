import { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  getRequestId,
  requestIdMiddleware,
  runWithRequestId,
} from '../requestIdMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('requestIdMiddleware', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('reuses a valid incoming request id header', () => {
    const req = createReq({ headers: { [REQUEST_ID_HEADER]: VALID_UUID } });

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe(VALID_UUID);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, VALID_UUID);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a fresh UUID when the header is missing or invalid', () => {
    const req = createReq({ headers: { [REQUEST_ID_HEADER]: 'not-a-uuid' } });

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(/^[0-9a-f]{8}-/);
    expect(req.requestId).not.toBe('not-a-uuid');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('exposes the id via AsyncLocalStorage helpers inside next()', () => {
    let observed: string | undefined;
    const req = createReq({ headers: { [REQUEST_ID_HEADER]: VALID_UUID } });
    const localNext = jest.fn(() => {
      observed = getRequestId();
    }) as unknown as NextFunction;

    requestIdMiddleware(req, res, localNext);

    expect(observed).toBe(VALID_UUID);

    const outside = runWithRequestId('fixed-id', () => getRequestId());
    expect(outside).toBe('fixed-id');
  });
});
