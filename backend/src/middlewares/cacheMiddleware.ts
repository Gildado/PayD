import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { cacheService } from '../services/cacheService.js';
import { cacheOperations } from '../utils/metrics.js';
import logger from '../utils/logger.js';

export interface CacheMiddlewareOptions {
  ttlSeconds: number;
  cacheControl?: string;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  tenantScoped?: boolean;
}

export function getTenantId(req: Request): string {
  return String(
    (req as any).tenantId ||
    (req as any).organizationId ||
    (req as any).user?.tenantId ||
    (req as any).user?.organizationId ||
    req.headers['x-tenant-id'] ||
    req.headers['x-organization-id'] ||
    'global'
  );
}

function defaultKeyGenerator(req: Request): string {
  return `${req.method}:${req.originalUrl}`;
}

function defaultCondition(req: Request): boolean {
  return req.method === 'GET';
}

export function buildCacheKey(req: Request, options: CacheMiddlewareOptions): string {
  const generator = options.keyGenerator || defaultKeyGenerator;
  const key = generator(req);
  const tenantId = options.tenantScoped !== false ? getTenantId(req) : 'global';
  const userIdentifier = (req as any).user?.id || 'anonymous';
  return `response:tenant:${tenantId}:${key}:${userIdentifier}`;
}

export function generateETag(body: any): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

interface CachedResponse {
  body: any;
  statusCode: number;
  headers: Record<string, string>;
  etag: string;
}

export function cacheResponse(options: CacheMiddlewareOptions) {
  const condition = options.condition || defaultCondition;
  const cacheControlHeader = options.cacheControl || `public, max-age=${options.ttlSeconds}`;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!condition(req)) {
      next();
      return;
    }

    const cacheKey = buildCacheKey(req, options);
    const clientETag = req.headers['if-none-match'];

    cacheService
      .get<CachedResponse>(cacheKey)
      .then((cached) => {
        if (cached) {
          const etagMatches =
            clientETag &&
            (clientETag === cached.etag || clientETag === `W/${cached.etag}`);

          if (etagMatches) {
            cacheOperations.inc({ operation: 'get', result: 'hit' });
            res.setHeader('ETag', cached.etag);
            res.setHeader('Cache-Control', cacheControlHeader);
            res.setHeader('X-Cache', 'HIT');
            res.status(304).end();
            return;
          }

          for (const [key, value] of Object.entries(cached.headers || {})) {
            res.setHeader(key, value);
          }
          res.setHeader('ETag', cached.etag);
          res.setHeader('Cache-Control', cacheControlHeader);
          res.setHeader('X-Cache', 'HIT');
          res.status(cached.statusCode).json(cached.body);
          return;
        }

        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
          const etag = generateETag(body);
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', cacheControlHeader);
          res.setHeader('X-Cache', 'MISS');

          const headers: Record<string, string> = {
            'content-type': String(res.getHeader('content-type') || 'application/json'),
          };

          cacheService
            .set(
              cacheKey,
              {
                body,
                statusCode: res.statusCode,
                headers,
                etag,
              },
              options.ttlSeconds
            )
            .catch((err) => {
              logger.error('Cache middleware write error', { error: err });
            });

          const etagMatches =
            clientETag && (clientETag === etag || clientETag === `W/${etag}`);

          if (etagMatches) {
            res.status(304).end();
            return res;
          }

          return originalJson(body);
        } as typeof res.json;

        next();
      })
      .catch((err) => {
        logger.error('Cache middleware read error', { error: err });
        next();
      });
  };
}

export function invalidateCache(pattern?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const tenantId = getTenantId(req);
        const targetPattern = pattern || `response:tenant:${tenantId}:*`;
        cacheService.deletePattern(targetPattern).catch((err) => {
          logger.error('Cache invalidation error', { pattern: targetPattern, error: err });
        });
      }
      return originalJson(body);
    } as typeof res.json;
    next();
  };
}
