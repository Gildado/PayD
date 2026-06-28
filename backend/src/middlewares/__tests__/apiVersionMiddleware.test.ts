import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  extractApiVersion,
  apiVersionMiddleware,
  requireApiVersion,
} from '../apiVersionMiddleware.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    _headers: headers,
  } as unknown as Response & { _headers: Record<string, string> };
}

function mockReq(path: string): Request {
  return { path, ip: '127.0.0.1', method: 'GET' } as unknown as Request;
}

// ---------------------------------------------------------------------------
// extractApiVersion
// ---------------------------------------------------------------------------

describe('extractApiVersion', () => {
  it('returns v1 for /api/v1/ prefixed paths', () => {
    expect(extractApiVersion('/api/v1/employees')).toBe('v1');
    expect(extractApiVersion('/api/v1/payments/123')).toBe('v1');
  });

  it('returns null for legacy /api/ paths', () => {
    expect(extractApiVersion('/api/employees')).toBeNull();
    expect(extractApiVersion('/api/payroll')).toBeNull();
  });

  it('returns null for non-API paths', () => {
    expect(extractApiVersion('/health')).toBeNull();
    expect(extractApiVersion('/rates')).toBeNull();
    expect(extractApiVersion('/')).toBeNull();
  });

  it('returns null for unknown version segments', () => {
    expect(extractApiVersion('/api/v99/employees')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// apiVersionMiddleware
// ---------------------------------------------------------------------------

describe('apiVersionMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn() as unknown as NextFunction;
  });

  it('sets version headers on every request', () => {
    const req = mockReq('/api/v1/employees');
    const res = mockRes();

    apiVersionMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1');
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Current-Version', 'v1');
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Supported-Versions', 'v1');
    expect(next).toHaveBeenCalled();
  });

  it('does not set deprecation headers for /api/v1/ routes', () => {
    const req = mockReq('/api/v1/employees');
    const res = mockRes();

    apiVersionMiddleware(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalledWith('Deprecation', expect.anything());
    expect(res.setHeader).not.toHaveBeenCalledWith('Sunset', expect.anything());
  });

  it('sets deprecation headers for legacy /api/ routes', () => {
    const req = mockReq('/api/employees');
    const res = mockRes();

    apiVersionMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-API-Deprecation-Message',
      expect.stringContaining('/api/v1/')
    );
  });

  it('includes a successor-version Link header for legacy routes', () => {
    const req = mockReq('/api/employees');
    const res = mockRes();

    apiVersionMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      expect.stringContaining('rel="successor-version"')
    );
  });

  it('does not set deprecation headers for non-API paths', () => {
    const req = mockReq('/health');
    const res = mockRes();

    apiVersionMiddleware(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalledWith('Deprecation', expect.anything());
  });

  it('attaches apiVersion to the request object', () => {
    const req = mockReq('/api/v1/employees');
    const res = mockRes();

    apiVersionMiddleware(req, res, next);

    expect((req as Request & { apiVersion?: string }).apiVersion).toBe('v1');
  });

  it('defaults apiVersion to current version for non-versioned paths', () => {
    const req = mockReq('/health');
    const res = mockRes();

    apiVersionMiddleware(req, res, next);

    expect((req as Request & { apiVersion?: string }).apiVersion).toBe('v1');
  });
});

// ---------------------------------------------------------------------------
// requireApiVersion
// ---------------------------------------------------------------------------

describe('requireApiVersion', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn() as unknown as NextFunction;
  });

  it('calls next() when request meets the minimum version', () => {
    const req = { apiVersion: 'v1' } as unknown as Request;
    const res = mockRes();

    requireApiVersion('v1')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when request is below the minimum version', () => {
    // Simulate a hypothetical v0 (below v1) by overriding apiVersion
    const req = { apiVersion: 'v0' } as unknown as Request;
    const res = mockRes();

    requireApiVersion('v1')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unsupported API version' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
