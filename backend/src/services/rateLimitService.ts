import { Redis } from 'ioredis';
import { config, getRateLimitConfig } from '../config/env.js';
import logger from '../utils/logger.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface RateLimitTier {
  windowMs: number;
  maxRequests: number;
}

/**
 * Rate-limit tiers are initialised from env vars (via getRateLimitConfig) so
 * that operators can tune limits without a code change.  The `strict` tier has
 * no env override and keeps its hardcoded default of 20 req/min.
 */
function buildRateLimitTiers() {
  const envCfg = getRateLimitConfig();
  return {
    auth: {
      windowMs: envCfg.auth.windowMs,
      maxRequests: envCfg.auth.maxRequests,
    },
    api: {
      windowMs: envCfg.api.windowMs,
      maxRequests: envCfg.api.maxRequests,
    },
    data: {
      windowMs: envCfg.data.windowMs,
      maxRequests: envCfg.data.maxRequests,
    },
    strict: {
      windowMs: 60 * 1000,
      maxRequests: 20,
    },
  } as const;
}

const RATE_LIMIT_TIERS = buildRateLimitTiers();

export type RateLimitTierName = keyof typeof RATE_LIMIT_TIERS;

class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis | null {
    if (!this.instance && config.REDIS_URL) {
      this.instance = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.instance.on('error', (err: Error) => {
        logger.error('Redis connection error', { error: err.message });
      });

      this.instance.on('connect', () => {
        logger.info('Redis connected for rate limiting');
      });
    }
    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
    }
  }
}

/** Shared Redis connection for caching and rate limits (lazy, same URL). */
export function getRedisClient(): Redis | null {
  return RedisClient.getInstance();
}

export class RateLimitService {
  private redis: Redis | null;

  private memoryStore: Map<string, { count: number; resetAt: number }> = new Map();
  private useMemoryFallback: boolean = false;

  constructor() {
    this.redis = RedisClient.getInstance();

    if (!this.redis) {
      logger.warn(
        'Redis not configured, using in-memory rate limiting (not recommended for production)'
      );
      this.useMemoryFallback = true;
    }

    if (this.useMemoryFallback) {
      setInterval(() => this.cleanupMemoryStore(), 60 * 1000);
    }
  }

  async checkRateLimit(
    identifier: string,
    tier: RateLimitTierName = 'api'
  ): Promise<RateLimitResult> {
    const tierConfig = RATE_LIMIT_TIERS[tier];
    const key = `ratelimit:${tier}:${identifier}`;
    const now = Date.now();
    const windowStart = now - tierConfig.windowMs;

    if (this.useMemoryFallback || !this.redis) {
      return this.checkMemoryRateLimit(key, tierConfig, now);
    }

    return this.checkRedisRateLimit(key, tierConfig, now);
  }

  private async checkRedisRateLimit(
    key: string,
    config: RateLimitTier,
    now: number
  ): Promise<RateLimitResult> {
    try {
      const redis = this.redis!;

      const results = await redis
        .multi()
        .zremrangebyscore(key, '-inf', now - config.windowMs)
        .zcard(key)
        .zadd(key, now, `${now}-${Math.random()}`)
        .pttl(key)
        .exec();

      if (!results) {
        return this.checkMemoryRateLimit(key, config, now);
      }

      const currentCount = (results[1]?.[1] as number) || 0;
      const ttl = (results[3]?.[1] as number) || config.windowMs;

      if (ttl < 0) {
        await redis.pexpire(key, config.windowMs);
      }

      const limit = config.maxRequests;
      const remaining = Math.max(0, limit - currentCount - 1);
      const resetAt = new Date(now + (ttl > 0 ? ttl : config.windowMs));

      if (currentCount >= limit) {
        const retryAfter = Math.ceil((ttl > 0 ? ttl : config.windowMs) / 1000);

        return {
          allowed: false,
          limit,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }

      return {
        allowed: true,
        limit,
        remaining,
        resetAt,
      };
    } catch (error) {
      logger.error('Redis rate limit error, falling back to memory', { error });
      return this.checkMemoryRateLimit(key, config, now);
    }
  }

  private checkMemoryRateLimit(key: string, config: RateLimitTier, now: number): RateLimitResult {
    const entry = this.memoryStore.get(key);
    const resetAt = now + config.windowMs;

    if (!entry || entry.resetAt < now) {
      this.memoryStore.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetAt: new Date(resetAt),
      };
    }

    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        retryAfter,
      };
    }

    entry.count++;
    this.memoryStore.set(key, entry);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - entry.count,
      resetAt: new Date(entry.resetAt),
    };
  }

  private cleanupMemoryStore(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.resetAt < now) {
        this.memoryStore.delete(key);
      }
    }
  }

  async resetRateLimit(identifier: string, tier: RateLimitTierName = 'api'): Promise<void> {
    const key = `ratelimit:${tier}:${identifier}`;

    if (this.redis && !this.useMemoryFallback) {
      await this.redis.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  getTierConfig(tier: RateLimitTierName): RateLimitTier {
    return RATE_LIMIT_TIERS[tier];
  }
}

export const rateLimitService = new RateLimitService();
