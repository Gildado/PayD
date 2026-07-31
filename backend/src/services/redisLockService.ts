import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { getRedisClient } from './rateLimitService.js';
import logger from '../utils/logger.js';

const DEFAULT_TTL_MS = 30_000;
const RENEWAL_INTERVAL_MS = 10_000;

// Lua script for atomic unlock: only release if the token matches.
const UNLOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// Lua script for atomic renewal: only extend if the token still matches.
const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

export interface AcquireOptions {
  ttlMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface LockHandle {
  release(): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RedisLockService {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Acquire a distributed lock for `key`. Returns a LockHandle whose
   * `release()` method must be called when the critical section exits.
   *
   * Auto-renewal keeps the lock alive while the caller is still working;
   * renewal stops as soon as `release()` is called.
   *
   * Throws if the lock cannot be acquired within the retry budget.
   */
  async acquire(key: string, options: AcquireOptions = {}): Promise<LockHandle> {
    const {
      ttlMs = DEFAULT_TTL_MS,
      retryCount = 10,
      retryDelayMs = 200,
    } = options;

    if (!this.redis) {
      logger.warn('RedisLockService: Redis not available, lock acquisition skipped', { key });
      return { release: async () => {} };
    }

    const token = randomUUID();
    const lockKey = `lock:${key}`;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');

      if (result === 'OK') {
        logger.debug('Distributed lock acquired', { key: lockKey, token, ttlMs });

        let released = false;
        let renewalTimer: ReturnType<typeof setInterval> | null = null;

        const stopRenewal = () => {
          if (renewalTimer) {
            clearInterval(renewalTimer);
            renewalTimer = null;
          }
        };

        renewalTimer = setInterval(async () => {
          if (released) {
            stopRenewal();
            return;
          }
          try {
            const renewed = await this.redis!.eval(RENEW_SCRIPT, 1, lockKey, token, String(ttlMs));
            if (renewed !== 1) {
              logger.warn('Distributed lock renewal failed — lock may have expired', { key: lockKey });
              stopRenewal();
            }
          } catch (err) {
            logger.error('Distributed lock renewal error', err);
          }
        }, RENEWAL_INTERVAL_MS);

        const release = async (): Promise<void> => {
          if (released) return;
          released = true;
          stopRenewal();
          try {
            await this.redis!.eval(UNLOCK_SCRIPT, 1, lockKey, token);
            logger.debug('Distributed lock released', { key: lockKey });
          } catch (err) {
            logger.error('Failed to release distributed lock', err);
          }
        };

        return { release };
      }

      if (attempt < retryCount) {
        await sleep(retryDelayMs);
      }
    }

    throw new Error(`Failed to acquire distributed lock for key "${key}" after ${retryCount + 1} attempts`);
  }

  /**
   * Convenience wrapper: acquires a lock, runs `fn`, and always releases.
   */
  async withLock<T>(key: string, fn: () => Promise<T>, options?: AcquireOptions): Promise<T> {
    const handle = await this.acquire(key, options);
    try {
      return await fn();
    } finally {
      await handle.release();
    }
  }
}

export const redisLockService = new RedisLockService();
