import { Request, Response, NextFunction } from 'express';
import { rateLimitService, RateLimitTierName } from '../services/rateLimitService';
import logger from '../utils/logger';

export interface RateLimitOptions {
  tier?: RateLimitTierName;
  identifier?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
}

function defaultIdentifier(req: Request): string {
  return req.ip || 
         req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
         req.headers['x-real-ip']?.toString() ||
         'unknown';
}

function defaultHandler(_req: Request, res: Response, result: any): void {
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: result.retryAfter,
    limit: result.limit,
  });
}

export function rateLimitMiddleware(options: RateLimitOptions = {}) {
  const {
    tier = 'api',
    identifier = defaultIdentifier,
    skip,
    handler,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (skip && skip(req)) {
      return next();
    }

    const clientIdentifier = identifier(req);
    const tierConfig = rateLimitService.getTierConfig(tier);

    try {
      const result = await rateLimitService.checkRateLimit(clientIdentifier, tier);

      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 60);
        
        logger.warn('Rate limit exceeded', {
          ip: clientIdentifier,
          tier,
          path: req.path,
          method: req.method,
          limit: result.limit,
        });

        if (handler) {
          handler(req, res);
        } else {
          defaultHandler(req, res, result);
        }
        return;
      }

      res.on('finish', () => {
        if (res.statusCode === 429) {
          logger.info('Rate limit response sent', {
            ip: clientIdentifier,
            tier,
            path: req.path,
          });
        }
      });

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', { error });
      next();
    }
  };
}

export function authRateLimit(options: Omit<RateLimitOptions, 'tier'> = {}) {
  return rateLimitMiddleware({ ...options, tier: 'auth' });
}

export function apiRateLimit(options: Omit<RateLimitOptions, 'tier'> = {}) {
  return rateLimitMiddleware({ ...options, tier: 'api' });
}

export function dataRateLimit(options: Omit<RateLimitOptions, 'tier'> = {}) {
  return rateLimitMiddleware({ ...options, tier: 'data' });
}

export function strictRateLimit(options: Omit<RateLimitOptions, 'tier'> = {}) {
  return rateLimitMiddleware({ ...options, tier: 'strict' });
}

export function apiKeyRateLimit(options: Omit<RateLimitOptions, 'identifier'> = {}) {
  return rateLimitMiddleware({
    ...options,
    tier: options.tier || 'api',
    identifier: (req: Request) => {
      const apiKey = req.headers['x-api-key']?.toString();
      if (apiKey) {
        return `apikey:${apiKey}`;
      }
      return defaultIdentifier(req);
    },
  });
}
