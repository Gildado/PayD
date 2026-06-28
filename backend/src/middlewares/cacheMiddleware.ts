import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService.js';
import logger from '../utils/logger.js';

export interface CacheMiddlewareOptions {
  ttlSeconds: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

function defaultKeyGenerator(req: Request): string {
  return `${req.method}:${req.originalUrl}`;
}

function defaultCondition(req: Request): boolean {
  return req.method === 'GET';
}

function buildCacheKey(req: Request, options: CacheMiddlewareOptions): string {
  const generator = options.keyGenerator || defaultKeyGenerator;
  const key = generator(req);

  const userIdentifier = (req as any).user?.id || 'anonymous';
  return `response:${key}:${userIdentifier}`;
}

export function cacheResponse(options: CacheMiddlewareOptions) {
  const condition = options.condition || defaultCondition;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!condition(req)) {
      next();
      return;
    }

    const cacheKey = buildCacheKey(req, options);

    cacheService.get<{ body: any; statusCode: number; headers: Record<string, string> }>(cacheKey)
      .then((cached) => {
        if (cached) {
          for (const [key, value] of Object.entries(cached.headers)) {
            res.setHeader(key, value);
          }
          res.setHeader('X-Cache', 'HIT');
          res.status(cached.statusCode).json(cached.body);
          return;
        }

        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
          const headers: Record<string, string> = {};
          const cacheHeaders = ['content-type'];
          for (const h of cacheHeaders) {
            const val = res.getHeader(h);
            if (val) headers[h] = String(val);
          }

          cacheService.set(cacheKey, {
            body,
            statusCode: res.statusCode,
            headers,
          }, options.ttlSeconds).catch((err) => {
            logger.error('Cache middleware write error', { error: err });
          });

          res.setHeader('X-Cache', 'MISS');
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

export function invalidateCache(pattern: string) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      cacheService.deletePattern(pattern).catch((err) => {
        logger.error('Cache invalidation error', { pattern, error: err });
      });
      return originalJson(body);
    } as typeof res.json;
    next();
  };
}
