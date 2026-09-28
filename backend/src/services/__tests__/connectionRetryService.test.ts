import { withRetry, withConnectionRetry, RetryOptions } from '../utils/retry.js';
import { ConnectionRetryService, connectionRetryService } from '../services/connectionRetryService.js';

describe('Retry Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on connection errors', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })
      ).rejects.toThrow('ECONNREFUSED');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-connection errors by default', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })
      ).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry custom errors when specified', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Custom error'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        retryableErrors: ['Custom error'],
      });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        onRetry,
      });

      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('withConnectionRetry', () => {
    it('should retry on various connection errors', async () => {
      const connectionErrors = [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'Socket hang up',
      ];

      for (const error of connectionErrors) {
        const fn = jest.fn()
          .mockRejectedValueOnce(new Error(error))
          .mockResolvedValue('success');

        const result = await withConnectionRetry(fn, {
          maxRetries: 1,
          baseDelayMs: 10,
        });
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      }
    });
  });
});

describe('ConnectionRetryService', () => {
  let service: ConnectionRetryService;

  beforeEach(() => {
    service = new ConnectionRetryService();
    jest.clearAllMocks();
  });

  it('should execute function with retry', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await service.executeWithRetry(
      { serviceName: 'test' },
      fn
    );
    expect(result).toBe('success');
  });

  it('should track health on success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    await service.executeWithRetry({ serviceName: 'test' }, fn);

    const health = service.getHealth('test');
    expect(health).toBeDefined();
    expect(health?.healthy).toBe(true);
    expect(health?.consecutiveFailures).toBe(0);
  });

  it('should track health on failure', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.executeWithRetry(
        { serviceName: 'test', retryOptions: { maxRetries: 0 } },
        fn
      )
    ).rejects.toThrow();

    const health = service.getHealth('test');
    expect(health).toBeDefined();
    expect(health?.healthy).toBe(false);
    expect(health?.consecutiveFailures).toBe(1);
  });

  it('should get all health statuses', async () => {
    const fn1 = jest.fn().mockResolvedValue('success');
    const fn2 = jest.fn().mockResolvedValue('success');

    await service.executeWithRetry({ serviceName: 'service1' }, fn1);
    await service.executeWithRetry({ serviceName: 'service2' }, fn2);

    const allHealth = service.getAllHealth();
    expect(allHealth.size).toBe(2);
    expect(allHealth.has('service1')).toBe(true);
    expect(allHealth.has('service2')).toBe(true);
  });

  it('should reset health', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    await service.executeWithRetry({ serviceName: 'test' }, fn);

    service.resetHealth('test');
    const health = service.getHealth('test');
    expect(health).toBeUndefined();
  });
});
