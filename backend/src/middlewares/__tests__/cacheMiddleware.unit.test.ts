import { NextFunction, Request, Response } from 'express';
import { cacheService } from '../../services/cacheService.js';
import { cacheOperations } from '../../utils/metrics.js';
import {
  buildCacheKey,
  cacheResponse,
  generateETag,
  getTenantId,
  invalidateCache,
} from '../cacheMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/cacheService', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    deletePattern: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../utils/metrics', () => ({ cacheOperations: { inc: jest.fn() } }));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGet = cacheService.get as jest.Mock;
const mockSet = cacheService.set as jest.Mock;
const mockDelete = cacheService.deletePattern as jest.Mock;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function getReq(overrides: Record<string, unknown> = {}): Request {
  return createReq({
    method: 'GET',
    originalUrl: '/api/employees',
    tenantId: 5,
    headers: {},
    ...overrides,
  });
}

describe('cache key helpers', () => {
  it('derives the tenant id and builds a tenant-scoped key', () => {
    const req = getReq({ user: { id: 'u1' } });
    expect(getTenantId(req)).toBe('5');
    expect(buildCacheKey(req, { ttlSeconds: 60 })).toBe(
      'response:tenant:5:GET:/api/employees:u1'
    );
  });

  it('generates a deterministic ETag', () => {
    expect(generateETag({ a: 1 })).toBe(generateETag({ a: 1 }));
    expect(generateETag('hello')).toMatch(/^"[a-f0-9]{32}"$/);
  });
});

describe('cacheResponse', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(undefined);
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('skips caching for a non-GET request (condition false)', async () => {
    await cacheResponse({ ttlSeconds: 60 })(getReq({ method: 'POST' }), res, next);
    await flush();

    expect(mockGet).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets MISS headers and stores the response on a cache miss', async () => {
    await cacheResponse({ ttlSeconds: 300 })(getReq(), res, next);
    await flush();

    expect(next).toHaveBeenCalledTimes(1);
    res.json({ id: 1 });
    await flush();

    expect(res._getHeader).toHaveBeenCalledWith('content-type');
    expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
    expect(mockSet).toHaveBeenCalled();
  });

  it('returns 304 without calling next on a matching ETag cache hit', async () => {
    const body = { id: 1 };
    const etag = generateETag(body);
    mockGet.mockResolvedValue({ body, statusCode: 200, headers: {}, etag });

    await cacheResponse({ ttlSeconds: 60 })(
      getReq({ headers: { 'if-none-match': etag } }),
      res,
      next
    );
    await flush();

    expect(res._status).toHaveBeenCalledWith(304);
    expect(res._end).toHaveBeenCalled();
    expect(cacheOperations.inc).toHaveBeenCalledWith({ operation: 'get', result: 'hit' });
    expect(next).not.toHaveBeenCalled();
  });

  it('serves a cached body on a cache hit without a matching ETag', async () => {
    const body = { id: 2 };
    mockGet.mockResolvedValue({
      body,
      statusCode: 200,
      headers: { 'x-custom': 'yes' },
      etag: generateETag(body),
    });

    await cacheResponse({ ttlSeconds: 60 })(getReq(), res, next);
    await flush();

    expect(res._status).toHaveBeenCalledWith(200);
    expect(res._json).toHaveBeenCalledWith(body);
    expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
    expect(next).not.toHaveBeenCalled();
  });

  it('fails open by calling next when the cache read throws', async () => {
    mockGet.mockRejectedValue(new Error('redis down'));

    await cacheResponse({ ttlSeconds: 60 })(getReq(), res, next);
    await flush();

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });
});

describe('invalidateCache', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockResolvedValue(undefined);
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('deletes the tenant pattern after a successful response', async () => {
    res.statusCode = 201;
    await invalidateCache()(getReq({ method: 'POST' }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    res.json({ ok: true });
    await flush();

    expect(mockDelete).toHaveBeenCalledWith('response:tenant:5:*');
  });

  it('does not invalidate on an error response', async () => {
    res.statusCode = 500;
    await invalidateCache()(getReq({ method: 'POST' }), res, next);
    res.json({ error: 'x' });
    await flush();

    expect(mockDelete).not.toHaveBeenCalled();
  });
});
