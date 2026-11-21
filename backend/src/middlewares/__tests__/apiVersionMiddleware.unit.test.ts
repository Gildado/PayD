import { NextFunction, Request, Response } from 'express';
import {
  apiVersionMiddleware,
  extractApiVersion,
  requireApiVersion,
} from '../apiVersionMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('extractApiVersion', () => {
  it('extracts v1 from a supported versioned path', () => {
    expect(extractApiVersion('/api/v1/employees')).toBe('v1');
  });

  it('returns null for legacy, non-api, and unknown-version paths', () => {
    expect(extractApiVersion('/api/employees')).toBeNull();
    expect(extractApiVersion('/health')).toBeNull();
    expect(extractApiVersion('/api/v99/employees')).toBeNull();
  });
});

describe('apiVersionMiddleware', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('sets version headers and calls next for a supported route (success)', () => {
    const req = createReq({ path: '/api/v1/employees', method: 'GET' });

    apiVersionMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1');
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Supported-Versions', 'v1');
    expect((req as Request & { apiVersion?: string }).apiVersion).toBe('v1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('adds deprecation headers for a legacy /api route (negative path)', () => {
    const req = createReq({ path: '/api/employees', method: 'GET' });

    apiVersionMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      expect.stringContaining('rel="successor-version"')
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requireApiVersion', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('calls next when the request meets the minimum version', () => {
    const req = createReq({ apiVersion: 'v1' });

    requireApiVersion('v1')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('returns 400 when the request is below the minimum version', () => {
    const req = createReq({ apiVersion: 'v0' });

    requireApiVersion('v1')(req, res, next);

    expect(res._status).toHaveBeenCalledWith(400);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unsupported API version' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
