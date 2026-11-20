import { Request, Response } from 'express';
import {
  cacheResponse,
  invalidateCache,
  generateETag,
  getTenantId,
  buildCacheKey,
} from '../cacheMiddleware.js';
import { cacheService } from '../../services/cacheService.js';

describe('cacheMiddleware', () => {
  beforeEach(async () => {
    await cacheService.flushAll();
  });

  describe('getTenantId & buildCacheKey', () => {
    it('extracts tenant ID correctly from req', () => {
      const req1 = { tenantId: 10 } as unknown as Request;
      expect(getTenantId(req1)).toBe('10');

      const req2 = { user: { tenantId: 20 } } as unknown as Request;
      expect(getTenantId(req2)).toBe('20');
    });

    it('builds tenant-scoped cache key', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/employees',
        tenantId: 5,
        user: { id: 'u123' },
      } as unknown as Request;

      const key = buildCacheKey(req, { ttlSeconds: 60 });
      expect(key).toBe('response:tenant:5:GET:/api/employees:u123');
    });
  });

  describe('generateETag', () => {
    it('generates consistent ETags for identical payloads', () => {
      const payload = { data: 'test' };
      const etag1 = generateETag(payload);
      const etag2 = generateETag(payload);
      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^"[a-f0-9]{32}"$/);
    });
  });

  describe('cacheResponse middleware', () => {
    it('sets ETag and Cache-Control headers on fresh GET request', async () => {
      const middleware = cacheResponse({ ttlSeconds: 300, cacheControl: 'public, max-age=300' });

      const req = {
        method: 'GET',
        originalUrl: '/api/employees',
        headers: {},
        tenantId: 1,
      } as unknown as Request;

      const headers: Record<string, string> = {};
      let jsonBody: any;
      const res = {
        statusCode: 200,
        setHeader: (key: string, value: string) => {
          headers[key] = value;
        },
        getHeader: (key: string) => headers[key],
        status: function (code: number) {
          this.statusCode = code;
          return this;
        },
        json: function (body: any) {
          jsonBody = body;
          return this;
        },
      } as unknown as Response;

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      middleware(req, res, next);
      expect(nextCalled).toBe(true);

      res.json({ id: 1, name: 'John Doe' });

      expect(headers['ETag']).toBeDefined();
      expect(headers['Cache-Control']).toBe('public, max-age=300');
      expect(headers['X-Cache']).toBe('MISS');
    });

    it('returns 304 Not Modified when If-None-Match matches', async () => {
      const middleware = cacheResponse({ ttlSeconds: 300 });

      const payload = { id: 1, name: 'Jane' };
      const etag = generateETag(payload);

      const req = {
        method: 'GET',
        originalUrl: '/api/employees/1',
        headers: { 'if-none-match': etag },
        tenantId: 1,
      } as unknown as Request;

      let endCalled = false;
      let statusCode = 200;
      const headers: Record<string, string> = {};

      const res = {
        statusCode: 200,
        setHeader: (key: string, value: string) => {
          headers[key] = value;
        },
        getHeader: (key: string) => headers[key],
        status: function (code: number) {
          statusCode = code;
          return this;
        },
        end: function () {
          endCalled = true;
        },
        json: function (body: any) {
          return this;
        },
      } as unknown as Response;

      const next = () => {};

      // Seed cache
      const cacheKey = buildCacheKey(req, { ttlSeconds: 300 });
      await cacheService.set(cacheKey, {
        body: payload,
        statusCode: 200,
        headers: {},
        etag,
      });

      middleware(req, res, next);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(statusCode).toBe(304);
      expect(endCalled).toBe(true);
    });
  });

  describe('invalidateCache middleware', () => {
    it('invalidates matching cached pattern on successful write', async () => {
      const cacheKey = 'response:tenant:10:GET:/api/employees:u1';
      await cacheService.set(cacheKey, { data: 'old' });

      const req = {
        method: 'POST',
        tenantId: 10,
      } as unknown as Request;

      const res = {
        statusCode: 201,
        json: function (body: any) {
          return body;
        },
      } as unknown as Response;

      const middleware = invalidateCache();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      res.json({ success: true });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const cached = await cacheService.get(cacheKey);
      expect(cached).toBeNull();
    });
  });
});
