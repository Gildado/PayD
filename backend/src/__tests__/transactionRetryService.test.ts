import { executeWithRetry, executeWithRetryOrThrow } from '../services/transactionRetryService';
import { HorizonErrorType } from '../services/horizonErrorClassifier';

describe('TransactionRetryService', () => {
  // ========================================================================
  // Success Cases
  // ========================================================================

  describe('executeWithRetry - Success', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should pass context to operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      await executeWithRetry(operation);

      expect(operation).toHaveBeenCalledWith({
        fee: undefined,
        sequence: undefined,
      });
    });

    it('should handle various result types', async () => {
      const results = [
        { txHash: '123' },
        ['item1', 'item2'],
        123,
        'string',
        null,
      ];

      for (const expected of results) {
        const operation = jest.fn().mockResolvedValue(expected);
        const result = await executeWithRetry(operation);

        expect(result.success).toBe(true);
        expect(result.result).toEqual(expected);
      }
    });
  });

  // ========================================================================
  // Retry Behavior
  // ========================================================================

  describe('executeWithRetry - Retry Behavior', () => {
    it('should retry on transient errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout ECONNABORTED'))
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retriable errors', async () => {
      const error = new Error('Bad auth');
      (error as any).response = {
        status: 400,
        data: {
          extras: {
            result_codes: { transaction: 'tx_bad_auth' },
          },
        },
      };

      const operation = jest.fn().mockRejectedValue(error);

      const result = await executeWithRetry(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect maxAttempts config', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('timeout'));

      const result = await executeWithRetry(operation, { maxAttempts: 2 });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should disable retry with enableRetry=false', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('timeout'));

      const result = await executeWithRetry(operation, { enableRetry: false });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
    });
  });

  // ========================================================================
  // Fee Bump Retry
  // ========================================================================

  describe('executeWithRetry - Fee Bump', () => {
    it('should apply fee bump on INSUFFICIENT_FEE', async () => {
      const insufficientFeeError = new Error('insufficient_fee');
      (insufficientFeeError as any).response = {
        status: 400,
        data: {
          extras: {
            result_codes: { transaction: 'tx_insufficient_fee' },
          },
        },
      };

      let callCount = 0;
      const operation = jest.fn().mockImplementation((ctx) => {
        callCount++;
        if (callCount === 1) {
          throw insufficientFeeError;
        }
        // Second call succeeds
        expect(ctx?.fee).toBeDefined();
        return Promise.resolve('success');
      });

      const result = await executeWithRetry(operation, { enableFeeBump: true });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      // Verify fee was bumped in context of second call
      expect(operation).toHaveBeenCalledWith(
        expect.objectContaining({
          fee: expect.any(Number),
        })
      );
    });

    it('should apply fee bump on BAD_SEQ with sequence update', async () => {
      const badSeqError = new Error('bad_seq');
      (badSeqError as any).response = {
        status: 400,
        data: {
          extras: {
            result_codes: { transaction: 'tx_bad_seq' },
            ledger_attr: 50000000,
          },
        },
      };

      let callCount = 0;
      const operation = jest.fn().mockImplementation((ctx) => {
        callCount++;
        if (callCount === 1) {
          throw badSeqError;
        }
        // Second call succeeds with updated sequence
        expect(ctx?.sequence).toBe(50000001);
        expect(ctx?.fee).toBeDefined();
        return Promise.resolve('success');
      });

      const result = await executeWithRetry(operation, { enableFeeBump: true });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should disable fee bump with enableFeeBump=false', async () => {
      const insufficientFeeError = new Error('insufficient_fee');
      (insufficientFeeError as any).response = {
        status: 400,
        data: {
          extras: {
            result_codes: { transaction: 'tx_insufficient_fee' },
          },
        },
      };

      const operation = jest
        .fn()
        .mockRejectedValueOnce(insufficientFeeError)
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(operation, { enableFeeBump: false });

      // Should succeed on retry (timeout would work too)
      expect(result.attempts).toBeLessThanOrEqual(2);
    });
  });

  // ========================================================================
  // Attempt History
  // ========================================================================

  describe('executeWithRetry - Attempt History', () => {
    it('should track attempt history', async () => {
      const error1 = new Error('timeout 1');
      const error2 = new Error('timeout 2');

      const operation = jest
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(operation);

      expect(result.attemptHistory.length).toBe(3);
      expect(result.attemptHistory[0].success).toBe(false);
      expect(result.attemptHistory[0].error).toBe(error1);
      expect(result.attemptHistory[1].success).toBe(false);
      expect(result.attemptHistory[1].error).toBe(error2);
      expect(result.attemptHistory[2].success).toBe(true);
      expect(result.attemptHistory[2].error).toBeUndefined();
    });

    it('should include backoff and fee bump info in history', async () => {
      const insufficientFeeError = new Error('insufficient_fee');
      (insufficientFeeError as any).response = {
        status: 400,
        data: {
          extras: {
            result_codes: { transaction: 'tx_insufficient_fee' },
          },
        },
      };

      const operation = jest
        .fn()
        .mockRejectedValueOnce(insufficientFeeError)
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(operation, { enableFeeBump: true });

      expect(result.attemptHistory[0].backoffMs).toBeGreaterThanOrEqual(0);
      expect(result.attemptHistory[0].feeBumpMultiplier).toBe(1.3);
    });

    it('should include classification in attempt record', async () => {
      const insufficientFeeError = new Error('insufficient_fee');
      (insufficientFeeError as any).response = {
        status: 400,
        data: {
          extras: {
            result_codes: { transaction: 'tx_insufficient_fee' },
          },
        },
      };

      const operation = jest
        .fn()
        .mockRejectedValueOnce(insufficientFeeError)
        .mockResolvedValueOnce('success');

      const result = await executeWithRetry(operation);

      expect(result.attemptHistory[0].classification?.errorType).toBe(
        HorizonErrorType.INSUFFICIENT_FEE
      );
      expect(result.attemptHistory[0].classification?.retriable).toBe(true);
    });
  });

  // ========================================================================
  // Max Retries Limit
  // ========================================================================

  describe('executeWithRetry - Max Retries', () => {
    it('should respect per-error maxRetries from matrix', async () => {
      const rateError = new Error('rate limited');
      (rateError as any).response = {
        status: 429,
        data: { title: 'Too Many Requests' },
      };

      const operation = jest.fn().mockRejectedValue(rateError);

      const result = await executeWithRetry(operation, { maxAttempts: 10 });

      // Rate limited has maxRetries=1, so max 2 attempts (1 + 1 retry)
      expect(result.attempts).toBeLessThanOrEqual(2);
    });

    it('should respect overrideMaxRetries config', async () => {
      const error = new Error('timeout');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await executeWithRetry(operation, {
        maxAttempts: 10,
        overrideMaxRetries: 1,
      });

      expect(result.attempts).toBeLessThanOrEqual(2);
    });
  });

  // ========================================================================
  // Error Cases
  // ========================================================================

  describe('executeWithRetry - Error Cases', () => {
    it('should return error after exhausting retries', async () => {
      const error = new Error('timeout');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await executeWithRetry(operation, { maxAttempts: 2 });

      expect(result.success).toBe(false);
      expect(result.result).toBe(error);
      expect(result.attempts).toBe(2);
      expect(result.finalClassification?.errorType).toBe(HorizonErrorType.TIMEOUT);
    });

    it('should wrap non-Error values as Error', async () => {
      const operation = jest.fn().mockRejectedValue('string error');

      const result = await executeWithRetry(operation);

      expect(result.success).toBe(false);
      expect(result.result instanceof Error).toBe(true);
    });
  });

  // ========================================================================
  // executeWithRetryOrThrow
  // ========================================================================

  describe('executeWithRetryOrThrow', () => {
    it('should return result on success', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await executeWithRetryOrThrow(operation);

      expect(result).toBe('success');
    });

    it('should throw on failure', async () => {
      const error = new Error('timeout');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(executeWithRetryOrThrow(operation)).rejects.toThrow();
    });

    it('should throw after exhausting retries', async () => {
      const error = new Error('insufficient_fee');
      (error as any).response = {
        status: 400,
        data: {
          extras: {
            result_codes: { transaction: 'tx_insufficient_fee' },
          },
        },
      };

      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        executeWithRetryOrThrow(operation, { maxAttempts: 1 })
      ).rejects.toThrow(error.message);
    });
  });

  // ========================================================================
  // Timing Verification (Integration)
  // ========================================================================

  describe('executeWithRetry - Timing', () => {
    jest.useFakeTimers();

    it('should apply backoff delay between retries', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('success');

      const promise = executeWithRetry(operation, { maxAttempts: 2 });

      // Should not resolve immediately
      jest.advanceTimersByTime(50);
      await Promise.resolve(); // Let microtasks run
      expect(operation).toHaveBeenCalledTimes(1);

      // Advance past backoff (base 100ms)
      jest.advanceTimersByTime(150);
      await Promise.resolve();

      const result = await promise;
      expect(result.success).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });
});
