import { Redis } from 'ioredis';
import { getRedisClient } from './rateLimitService.js';
import { cacheOperations, cacheQueryDuration } from '../utils/metrics.js';
import logger from '../utils/logger.js';

export interface CacheOptions {
  ttlSeconds: number;
  keyPrefix?: string;
}

export enum CacheTier {
  SHORT = 60,
  MEDIUM = 300,
  LONG = 3600,
  VERY_LONG = 86400,
}

const DEFAULT_OPTIONS: CacheOptions = {
  ttlSeconds: CacheTier.MEDIUM,
  keyPrefix: 'cache',
};

export class CacheService {
  private redis: Redis | null;
  private memoryStore: Map<string, { value: string; expiresAt: number }> = new Map();
  private useMemoryFallback: boolean = false;

  constructor(private options: CacheOptions = DEFAULT_OPTIONS) {
    this.redis = getRedisClient();

    if (!this.redis) {
      logger.warn('Redis not configured, using in-memory cache fallback');
      this.useMemoryFallback = true;
    }

    if (this.useMemoryFallback) {
      setInterval(() => this.cleanupMemoryStore(), 60 * 1000);
    }
  }

  private buildKey(key: string): string {
    return `${this.options.keyPrefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const end = cacheQueryDuration.startTimer({ operation: 'get' });

    try {
      if (this.useMemoryFallback || !this.redis) {
        const entry = this.memoryStore.get(fullKey);
        if (entry && entry.expiresAt > Date.now()) {
          cacheOperations.inc({ operation: 'get', result: 'hit' });
          end();
          return JSON.parse(entry.value) as T;
        }
        if (entry) {
          this.memoryStore.delete(fullKey);
        }
        cacheOperations.inc({ operation: 'get', result: 'miss' });
        end();
        return null;
      }

      const cached = await this.redis.get(fullKey);
      if (cached) {
        cacheOperations.inc({ operation: 'get', result: 'hit' });
        end();
        return JSON.parse(cached) as T;
      }

      cacheOperations.inc({ operation: 'get', result: 'miss' });
      end();
      return null;
    } catch (error) {
      cacheOperations.inc({ operation: 'get', result: 'error' });
      end();
      logger.error('Cache get error', { key: fullKey, error });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const ttl = ttlSeconds ?? this.options.ttlSeconds;
    const serialized = JSON.stringify(value);
    const end = cacheQueryDuration.startTimer({ operation: 'set' });

    try {
      if (this.useMemoryFallback || !this.redis) {
        this.memoryStore.set(fullKey, {
          value: serialized,
          expiresAt: Date.now() + ttl * 1000,
        });
        cacheOperations.inc({ operation: 'set', result: 'success' });
        end();
        return;
      }

      await this.redis.setex(fullKey, ttl, serialized);
      cacheOperations.inc({ operation: 'set', result: 'success' });
      end();
    } catch (error) {
      cacheOperations.inc({ operation: 'set', result: 'error' });
      end();
      logger.error('Cache set error', { key: fullKey, error });
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    const end = cacheQueryDuration.startTimer({ operation: 'delete' });

    try {
      if (this.useMemoryFallback || !this.redis) {
        this.memoryStore.delete(fullKey);
        cacheOperations.inc({ operation: 'delete', result: 'success' });
        end();
        return;
      }

      await this.redis.del(fullKey);
      cacheOperations.inc({ operation: 'delete', result: 'success' });
      end();
    } catch (error) {
      cacheOperations.inc({ operation: 'delete', result: 'error' });
      end();
      logger.error('Cache delete error', { key: fullKey, error });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.buildKey(pattern);
    const end = cacheQueryDuration.startTimer({ operation: 'deletePattern' });

    try {
      if (this.useMemoryFallback || !this.redis) {
        for (const key of this.memoryStore.keys()) {
          if (key.startsWith(fullPattern.replace('*', ''))) {
            this.memoryStore.delete(key);
          }
        }
        cacheOperations.inc({ operation: 'deletePattern', result: 'success' });
        end();
        return;
      }

      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');

      cacheOperations.inc({ operation: 'deletePattern', result: 'success' });
      end();
    } catch (error) {
      cacheOperations.inc({ operation: 'deletePattern', result: 'error' });
      end();
      logger.error('Cache deletePattern error', { pattern: fullPattern, error });
    }
  }

  async remember<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async flushAll(): Promise<void> {
    const end = cacheQueryDuration.startTimer({ operation: 'flush' });

    try {
      if (this.useMemoryFallback || !this.redis) {
        this.memoryStore.clear();
      } else {
        await this.redis.flushdb();
      }
      cacheOperations.inc({ operation: 'flush', result: 'success' });
      end();
    } catch (error) {
      cacheOperations.inc({ operation: 'flush', result: 'error' });
      end();
      logger.error('Cache flush error', { error });
    }
  }

  private cleanupMemoryStore(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt < now) {
        this.memoryStore.delete(key);
      }
    }
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    const fullPrefix = this.buildKey(prefix.replace('*', ''));
    const end = cacheQueryDuration.startTimer({ operation: 'invalidatePrefix' });

    try {
      if (this.useMemoryFallback || !this.redis) {
        let count = 0;
        for (const key of this.memoryStore.keys()) {
          if (key.startsWith(fullPrefix)) {
            this.memoryStore.delete(key);
            count += 1;
          }
        }
        cacheOperations.inc({ operation: 'invalidatePrefix', result: 'success' });
        end();
        return count;
      }

      let cursor = '0';
      let totalDeleted = 0;
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${fullPrefix}*`,
          'COUNT',
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          totalDeleted += await this.redis.del(...keys);
        }
      } while (cursor !== '0');

      cacheOperations.inc({ operation: 'invalidatePrefix', result: 'success' });
      end();
      return totalDeleted;
    } catch (error) {
      cacheOperations.inc({ operation: 'invalidatePrefix', result: 'error' });
      end();
      logger.error('Cache invalidatePrefix error', { prefix: fullPrefix, error });
      return 0;
    }
  }

  async warmCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<void> {
    try {
      const value = await fetchFn();
      await this.set(key, value, ttlSeconds);
      logger.debug('Cache warmed', { key: this.buildKey(key), ttl: ttlSeconds });
    } catch (error) {
      logger.error('Cache warm error', { key: this.buildKey(key), error });
    }
  }

  async setMultiple(
    entries: Array<{ key: string; value: unknown; ttlSeconds?: number }>
  ): Promise<void> {
    const results = await Promise.allSettled(
      entries.map(({ key, value, ttlSeconds }) => this.set(key, value, ttlSeconds))
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn('Multiple cache sets had failures', { total: entries.length, failed });
    }
  }

  getHealth(): { status: string; entries: number; usingRedis: boolean } {
    return {
      status: this.useMemoryFallback ? 'memory_fallback' : 'connected',
      entries: this.useMemoryFallback
        ? this.memoryStore.size
        : 0,
      usingRedis: !this.useMemoryFallback && this.redis !== null,
    };
  }
}

export const cacheService = new CacheService();
