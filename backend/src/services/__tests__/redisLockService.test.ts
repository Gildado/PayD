import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock ioredis (via rateLimitService.getRedisClient) ───────────────────────

const mockSet = jest.fn();
const mockEval = jest.fn();

jest.mock('../rateLimitService.js', () => ({
  getRedisClient: () => ({
    set: mockSet,
    eval: mockEval,
  }),
}));

import { RedisLockService } from '../redisLockService.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeService() {
  return new RedisLockService();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RedisLockService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('acquire', () => {
    it('acquires lock on first SET NX success', async () => {
      mockSet.mockResolvedValueOnce('OK');
      const svc = makeService();
      const handle = await svc.acquire('test-key');
      expect(mockSet).toHaveBeenCalledWith('lock:test-key', expect.any(String), 'PX', 30_000, 'NX');
      expect(handle).toBeDefined();
    });

    it('retries until lock is available then acquires', async () => {
      mockSet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('OK');
      const svc = makeService();
      const acquirePromise = svc.acquire('retry-key', { retryDelayMs: 0 });
      // advance timers to flush the retry sleeps
      await jest.runAllTimersAsync();
      const handle = await acquirePromise;
      expect(mockSet).toHaveBeenCalledTimes(3);
      expect(handle).toBeDefined();
    });

    it('throws after retries exhausted', async () => {
      mockSet.mockResolvedValue(null);
      const svc = makeService();
      const acquirePromise = svc.acquire('fail-key', { retryCount: 2, retryDelayMs: 0 });
      await jest.runAllTimersAsync();
      await expect(acquirePromise).rejects.toThrow(
        'Failed to acquire distributed lock for key "fail-key" after 3 attempts',
      );
    });

    it('release calls UNLOCK_SCRIPT with matching token', async () => {
      mockSet.mockResolvedValueOnce('OK');
      mockEval.mockResolvedValueOnce(1);
      const svc = makeService();
      const handle = await svc.acquire('release-key');
      await handle.release();
      expect(mockEval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get"'),
        1,
        'lock:release-key',
        expect.any(String),
      );
    });

    it('calling release twice is idempotent', async () => {
      mockSet.mockResolvedValueOnce('OK');
      mockEval.mockResolvedValue(1);
      const svc = makeService();
      const handle = await svc.acquire('idempotent-key');
      await handle.release();
      await handle.release();
      // eval should only be called once (second release exits early)
      expect(mockEval).toHaveBeenCalledTimes(1);
    });
  });

  describe('withLock', () => {
    it('runs fn and releases lock on success', async () => {
      mockSet.mockResolvedValueOnce('OK');
      mockEval.mockResolvedValueOnce(1);
      const svc = makeService();
      const fn = jest.fn().mockResolvedValue('result');
      const result = await svc.withLock('wl-key', fn as any);
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockEval).toHaveBeenCalledTimes(1); // release
    });

    it('releases lock even when fn throws', async () => {
      mockSet.mockResolvedValueOnce('OK');
      mockEval.mockResolvedValueOnce(1);
      const svc = makeService();
      const fn = jest.fn().mockRejectedValue(new Error('fn error'));
      await expect(svc.withLock('wl-err-key', fn as any)).rejects.toThrow('fn error');
      expect(mockEval).toHaveBeenCalledTimes(1); // lock still released
    });
  });

  describe('no-op when Redis unavailable', () => {
    it('returns a no-op handle and does not throw', async () => {
      jest.resetModules();
      jest.doMock('../rateLimitService.js', () => ({ getRedisClient: () => null }));
      const { RedisLockService: NoRedisService } = await import('../redisLockService.js');
      const svc = new NoRedisService();
      const handle = await svc.acquire('no-redis-key');
      await expect(handle.release()).resolves.toBeUndefined();
    });
  });
});
