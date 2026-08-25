import { getRedisClient } from './rateLimitService.js';
import { getIdempotencyTtlSeconds } from '../config/env.js';
import logger from '../utils/logger.js';

export interface IdempotencyRecord {
  /** HTTP status code of the original response */
  statusCode: number;
  /** Serialized response body of the original request */
  body: string;
  /** Content-Type of the original response */
  contentType: string;
  /** ISO timestamp of when the record was created */
  createdAt: string;
}

/** UUID v4 format required by the API contract (issue #1025). */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_TTL_SECONDS = 86400;

/**
 * In-memory fallback used when Redis is unavailable so that idempotency
 * guarantees degrade gracefully in local/dev environments.
 */
class MemoryIdempotencyStore {
  private map = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}

const memoryStore = new MemoryIdempotencyStore();

/**
 * IdempotencyService
 *
 * Provides durable idempotency-key semantics for mutating endpoints
 * (issue #1025). A client supplies an `Idempotency-Key` header; the first
 * request's response is stored and any retry with the same key replays the
 * stored response instead of executing the operation twice.
 *
 * Storage strategy:
 * - Redis (preferred) with TTL-based expiry
 * - In-memory fallback when Redis is not configured
 *
 * Race safety:
 * - `acquire` uses SET NX semantics so only one concurrent request with the
   same key proceeds; others receive a 409 Conflict until it completes.
 */
export class IdempotencyService {
  private static buildKey(tenantScope: string, key: string): string {
    return `idempotency:t:${tenantScope}:${key}`;
  }

  static isValidKey(key: unknown): key is string {
    return typeof key === 'string' && UUID_V4_REGEX.test(key);
  }

  /**
   * Store a completed response for the given key.
   */
  static async storeResponse(
    tenantScope: string,
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number = getIdempotencyTtlSeconds() || DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const redis = getRedisClient();
    const fullKey = this.buildKey(tenantScope, key);
    const payload = JSON.stringify(record);

    try {
      if (redis) {
        await redis.set(fullKey, payload, 'EX', ttlSeconds);
      } else {
        await memoryStore.set(fullKey, payload, ttlSeconds);
      }
      logger.info(`[idempotency] Stored response for key ${key} (ttl=${ttlSeconds}s)`);
    } catch (err) {
      logger.error(`[idempotency] Failed to persist idempotency record ${key}:`, err);
    }
  }

  /**
   * Fetch a previously stored response for the given key, if any.
   */
  static async getResponse(
    tenantScope: string,
    key: string,
  ): Promise<IdempotencyRecord | null> {
    const redis = getRedisClient();
    const fullKey = this.buildKey(tenantScope, key);

    try {
      const raw = redis ? await redis.get(fullKey) : await memoryStore.get(fullKey);
      if (!raw) return null;
      return JSON.parse(raw) as IdempotencyRecord;
    } catch (err) {
      logger.error(`[idempotency] Failed to read idempotency record ${key}:`, err);
      return null;
    }
  }

  /**
   * Try to acquire an exclusive "in-flight" lock for the key using SET NX.
   * Returns true if this request owns the operation; false when another
   * request is already processing the same key.
   */
  static async acquire(tenantScope: string, key: string): Promise<boolean> {
    const redis = getRedisClient();
    const lockKey = `${this.buildKey(tenantScope, key)}:lock`;
    const ttlSeconds = getIdempotencyTtlSeconds() || DEFAULT_TTL_SECONDS;

    try {
      if (redis) {
        const result = await redis.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      }
      // Memory fallback: emulate NX via get/set race window
      const existing = await memoryStore.get(lockKey);
      if (existing) return false;
      await memoryStore.set(lockKey, '1', ttlSeconds);
      return true;
    } catch (err) {
      logger.error(`[idempotency] Failed to acquire idempotency lock ${key}:`, err);
      // On storage failure prefer availability: allow the request through.
      return true;
    }
  }

  /**
   * Release an in-flight lock after storing (or failing) the response.
   */
  static async releaseLock(tenantScope: string, key: string): Promise<void> {
    const redis = getRedisClient();
    const lockKey = `${this.buildKey(tenantScope, key)}:lock`;
    try {
      if (redis) {
        await redis.del(lockKey);
      } else {
        await memoryStore.del(lockKey);
      }
    } catch (err) {
      logger.error(`[idempotency] Failed to release idempotency lock ${key}:`, err);
    }
  }

  /**
   * Mark a request as permanently failed so clients may safely retry with
   * the same key later.
   */
  static async markFailed(tenantScope: string, key: string): Promise<void> {
    await this.releaseLock(tenantScope, key);
  }
}

export const idempotencyService = IdempotencyService;
