import { NextFunction, Request, Response } from 'express';
import {
  DeprecationTracker,
  deprecationHeadersMiddleware,
  getDeprecationTracker,
  trackingMiddleware,
} from '../deprecationHeaders.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('deprecationHeadersMiddleware', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('sets deprecation, sunset, link and warn headers and calls next', () => {
    const req = createReq({ path: '/api/v1/users' });
    const middleware = deprecationHeadersMiddleware({
      sunsetDate: 'Sat, 01 Jan 2027 00:00:00 GMT',
      successorPath: '/api/v2/users',
      message: 'Use v2',
    });

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Deprecated', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v2/users>; rel="successor-version"'
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Warn', 'Use v2');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('derives the successor link by rewriting /v1/ to /v2/ from the path (negative path)', () => {
    const req = createReq({ path: '/api/v1/payments' });

    deprecationHeadersMiddleware()(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v2/payments>; rel="successor-version"'
    );
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('DeprecationTracker', () => {
  it('registers and retrieves deprecated route info (success), returning undefined for unknown routes', () => {
    const tracker = new DeprecationTracker();
    const info = {
      path: '/api/v1/payments',
      method: 'GET' as const,
      deprecatedSince: '2026-01-01',
      sunsetDate: '2027-01-01',
      successorPath: '/api/v2/payments',
    };

    tracker.registerDeprecatedRoute(info);

    expect(tracker.getDeprecatedRouteInfo('GET', '/api/v1/payments')).toEqual(info);
    expect(tracker.getAllDeprecatedRoutes()).toHaveLength(1);
    expect(tracker.getDeprecatedRouteInfo('POST', '/nope')).toBeUndefined();
  });

  it('trackingMiddleware always calls next for registered and unregistered routes', () => {
    const tracker = getDeprecationTracker();
    tracker.registerDeprecatedRoute({
      path: '/api/v1/known',
      method: 'GET',
      deprecatedSince: '2026-01-01',
      sunsetDate: '2027-01-01',
      successorPath: '/api/v2/known',
    });
    const next = createNext() as jest.Mock & NextFunction;

    trackingMiddleware(createReq({ path: '/api/v1/known', ip: '1.2.3.4' }), createRes(), next);
    trackingMiddleware(createReq({ path: '/unknown' }), createRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});
