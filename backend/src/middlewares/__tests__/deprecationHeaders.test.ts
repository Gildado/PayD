import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

const mockWarn = jest.fn();
const mockInfo = jest.fn();

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { warn: mockWarn, info: mockInfo, error: jest.fn(), debug: jest.fn() },
}));

const {
  deprecationHeadersMiddleware,
  DeprecationTracker,
  getDeprecationTracker,
  trackingMiddleware,
} = await import('../deprecationHeaders.js');

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    _headers: headers,
  } as unknown as Response & { _headers: Record<string, string> };
}

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    path: '/api/v1/employees',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

const routeInfo = {
  path: '/api/v1/employees',
  method: 'GET' as const,
  deprecatedSince: '2026-01-01',
  sunsetDate: 'Fri, 01 Jan 2027 00:00:00 GMT',
  successorPath: '/api/v2/employees',
};

describe('deprecationHeadersMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn() as unknown as NextFunction;
  });

  it('sets deprecation headers with defaults and calls next()', () => {
    const res = mockRes();

    deprecationHeadersMiddleware()(mockReq(), res, next);

    expect(res._headers['Deprecated']).toBe('true');
    expect(res._headers['Sunset']).toMatch(/GMT$/);
    expect(res._headers['X-API-Warn']).toBe(
      'This API version is deprecated. Please migrate to the latest version.'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('derives the successor Link from the request path (v1 -> v2)', () => {
    const res = mockRes();

    deprecationHeadersMiddleware()(mockReq({ path: '/api/v1/payments' }), res, next);

    expect(res._headers['Link']).toBe('</api/v2/payments>; rel="successor-version"');
  });

  it('leaves paths without /v1/ unchanged in the Link header', () => {
    const res = mockRes();

    deprecationHeadersMiddleware()(mockReq({ path: '/legacy/things' }), res, next);

    expect(res._headers['Link']).toBe('</legacy/things>; rel="successor-version"');
  });

  it('honours a custom config (sunset, message, successorPath)', () => {
    const res = mockRes();

    deprecationHeadersMiddleware({
      sunsetDate: 'Fri, 01 Jan 2027 00:00:00 GMT',
      message: 'Use the new endpoint',
      successorPath: '/api/v1/new',
    })(mockReq(), res, next);

    expect(res._headers['Sunset']).toBe('Fri, 01 Jan 2027 00:00:00 GMT');
    expect(res._headers['X-API-Warn']).toBe('Use the new endpoint');
    expect(res._headers['Link']).toBe('</api/v2/new>; rel="successor-version"');
  });

  it('omits the Sunset header when sunsetDate is explicitly empty', () => {
    const res = mockRes();

    deprecationHeadersMiddleware({ sunsetDate: '' })(mockReq(), res, next);

    expect(res._headers['Sunset']).toBeUndefined();
    expect(res._headers['Deprecated']).toBe('true');
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('DeprecationTracker', () => {
  let tracker: InstanceType<typeof DeprecationTracker>;

  beforeEach(() => {
    jest.clearAllMocks();
    tracker = new DeprecationTracker();
  });

  it('registers a route and retrieves it by method and path', () => {
    tracker.registerDeprecatedRoute(routeInfo);

    expect(tracker.getDeprecatedRouteInfo('GET', '/api/v1/employees')).toEqual(routeInfo);
    expect(mockInfo).toHaveBeenCalledWith('Registered deprecated route: GET /api/v1/employees');
  });

  it('returns undefined for unknown routes or a different method', () => {
    tracker.registerDeprecatedRoute(routeInfo);

    expect(tracker.getDeprecatedRouteInfo('POST', '/api/v1/employees')).toBeUndefined();
    expect(tracker.getDeprecatedRouteInfo('GET', '/nope')).toBeUndefined();
  });

  it('lists all registered routes', () => {
    tracker.registerDeprecatedRoute(routeInfo);
    tracker.registerDeprecatedRoute({ ...routeInfo, method: 'POST' });

    expect(tracker.getAllDeprecatedRoutes()).toHaveLength(2);
  });

  it('logs a warning with client info when a deprecated route is used', () => {
    tracker.registerDeprecatedRoute(routeInfo);

    tracker.logDeprecatedRouteUsage('GET', '/api/v1/employees', '1.2.3.4');

    expect(mockWarn).toHaveBeenCalledTimes(1);
    const message = mockWarn.mock.calls[0][0] as string;
    expect(message).toContain('GET /api/v1/employees');
    expect(message).toContain('/api/v2/employees');
    expect(message).toContain('[1.2.3.4]');
  });

  it('does not log when the route is not deprecated', () => {
    tracker.logDeprecatedRouteUsage('GET', '/api/v1/other');

    expect(mockWarn).not.toHaveBeenCalled();
  });
});

describe('getDeprecationTracker / trackingMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a singleton tracker', () => {
    expect(getDeprecationTracker()).toBe(getDeprecationTracker());
  });

  it('logs usage of registered routes and always calls next()', () => {
    getDeprecationTracker().registerDeprecatedRoute({
      ...routeInfo,
      path: '/api/v1/tracked',
    });
    const next = jest.fn() as unknown as NextFunction;

    trackingMiddleware(mockReq({ path: '/api/v1/tracked' }), mockRes(), next);

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() without logging for untracked routes', () => {
    const next = jest.fn() as unknown as NextFunction;

    trackingMiddleware(mockReq({ path: '/api/v1/untracked' }), mockRes(), next);

    expect(mockWarn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
