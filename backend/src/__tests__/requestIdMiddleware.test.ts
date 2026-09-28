import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../middlewares/requestIdMiddleware.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Request ID middleware', () => {
  let setHeader: jest.Mock;
  let next: NextFunction;

  beforeEach(() => {
    setHeader = jest.fn();
    next = jest.fn();
  });

  it('returns an x-request-id header when missing', () => {
    const req = { headers: {} } as Request;
    const res = { setHeader } as unknown as Response;

    requestIdMiddleware(req, res, next);

    const requestId = req.requestId;
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(UUID_REGEX);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('preserves a valid incoming x-request-id header', () => {
    const incomingRequestId = '6dddcf1e-b862-4890-b95e-cf7466fa7cdd';
    const req = { headers: { 'x-request-id': incomingRequestId } } as unknown as Request;
    const res = { setHeader } as unknown as Response;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe(incomingRequestId);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', incomingRequestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces an invalid incoming x-request-id header with a UUID', () => {
    const req = { headers: { 'x-request-id': 'not-a-uuid' } } as unknown as Request;
    const res = { setHeader } as unknown as Response;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(UUID_REGEX);
    expect(req.requestId).not.toBe('not-a-uuid');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
