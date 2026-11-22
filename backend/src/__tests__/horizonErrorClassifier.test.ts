import {
  classifyHorizonError,
  calculateBackoffDelay,
  getFeeBumpMultiplier,
  requiresFeeBump,
  HorizonErrorType,
  RetryAction,
} from '../services/horizonErrorClassifier';

describe('HorizonErrorClassifier', () => {
  // ========================================================================
  // HTTP Status Code Classification
  // ========================================================================

  describe('HTTP Status-Based Classification', () => {
    it('should classify 429 as RATE_LIMITED', () => {
      const error = {
        response: {
          status: 429,
          data: { title: 'Too Many Requests' },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.RATE_LIMITED);
      expect(result.retriable).toBe(true);
      expect(result.maxRetries).toBe(1);
    });

    it('should classify 500+ as NETWORK_ERROR', () => {
      const error = {
        response: {
          status: 500,
          data: { title: 'Internal Server Error' },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.NETWORK_ERROR);
      expect(result.retriable).toBe(true);
      expect(result.maxRetries).toBe(3);
    });

    it('should classify 503 as NETWORK_ERROR', () => {
      const error = {
        response: {
          status: 503,
          data: { title: 'Service Unavailable' },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.NETWORK_ERROR);
      expect(result.action).toBe(RetryAction.RETRY);
    });

    it('should classify 408 as TIMEOUT', () => {
      const error = {
        response: {
          status: 408,
          data: { title: 'Request Timeout' },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.TIMEOUT);
      expect(result.retriable).toBe(true);
      expect(result.maxRetries).toBe(2);
    });
  });

  // ========================================================================
  // Connection Error Classification
  // ========================================================================

  describe('Connection Error Classification', () => {
    it('should classify ECONNREFUSED as NETWORK_ERROR', () => {
      const error = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.NETWORK_ERROR);
      expect(result.retriable).toBe(true);
    });

    it('should classify ECONNABORTED as TIMEOUT', () => {
      const error = {
        message: 'socket hang up ECONNABORTED',
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.TIMEOUT);
      expect(result.retriable).toBe(true);
    });

    it('should classify ENOTFOUND as NETWORK_ERROR', () => {
      const error = {
        message: 'getaddrinfo ENOTFOUND horizon.stellar.org',
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.NETWORK_ERROR);
    });

    it('should classify timeout message as TIMEOUT', () => {
      const error = {
        message: 'Request timeout after 30000ms',
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.TIMEOUT);
    });
  });

  // ========================================================================
  // Horizon Transaction Failure Classification
  // ========================================================================

  describe('Horizon Transaction Failures (400 status)', () => {
    it('should classify tx_bad_seq as BAD_SEQ', () => {
      const error = {
        response: {
          status: 400,
          data: {
            title: 'Transaction Failed',
            extras: {
              result_codes: {
                transaction: 'tx_bad_seq',
              },
              ledger_attr: 50000000,
            },
          },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.BAD_SEQ);
      expect(result.action).toBe(RetryAction.FEE_BUMP_RETRY);
      expect(result.retriable).toBe(true);
      expect(result.maxRetries).toBe(3);
      expect(result.ledgerSequence).toBe(50000000);
    });

    it('should classify tx_insufficient_fee as INSUFFICIENT_FEE', () => {
      const error = {
        response: {
          status: 400,
          data: {
            title: 'Transaction Failed',
            extras: {
              result_codes: {
                transaction: 'tx_insufficient_fee',
              },
            },
          },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.INSUFFICIENT_FEE);
      expect(result.action).toBe(RetryAction.FEE_BUMP_RETRY);
      expect(result.retriable).toBe(true);
      expect(result.maxRetries).toBe(2);
    });

    it('should classify "insufficient fee" message as INSUFFICIENT_FEE', () => {
      const error = {
        response: {
          status: 400,
          data: {
            title: 'insufficient fee for this transaction',
          },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.INSUFFICIENT_FEE);
      expect(result.action).toBe(RetryAction.FEE_BUMP_RETRY);
    });

    it('should classify tx_bad_auth as BAD_SIGNATURE', () => {
      const error = {
        response: {
          status: 400,
          data: {
            title: 'Transaction Failed',
            extras: {
              result_codes: {
                transaction: 'tx_bad_auth',
              },
            },
          },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.BAD_SIGNATURE);
      expect(result.retriable).toBe(false);
      expect(result.action).toBe(RetryAction.FAIL);
    });

    it('should classify tx_bad_auth_extra as BAD_SIGNATURE', () => {
      const error = {
        response: {
          status: 400,
          data: {
            title: 'Transaction Failed',
            extras: {
              result_codes: {
                transaction: 'tx_bad_auth_extra',
              },
            },
          },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.BAD_SIGNATURE);
      expect(result.retriable).toBe(false);
    });

    it('should classify invalid operation as INVALID_OPERATION', () => {
      const error = {
        response: {
          status: 400,
          data: {
            title: 'Transaction Failed',
            extras: {
              result_codes: {
                transaction: 'tx_failed',
                operations: ['op_no_destination', 'op_success'],
              },
            },
          },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.errorType).toBe(HorizonErrorType.INVALID_OPERATION);
      expect(result.retriable).toBe(false);
      expect(result.action).toBe(RetryAction.FAIL);
    });

    it('should extract and preserve result codes', () => {
      const error = {
        response: {
          status: 400,
          data: {
            title: 'Transaction Failed',
            extras: {
              result_codes: {
                transaction: 'tx_failed',
                operations: ['op_malformed', 'op_success', 'op_success'],
              },
            },
          },
        },
      };

      const result = classifyHorizonError(error);
      expect(result.resultCodes).toEqual({
        transaction: 'tx_failed',
        operations: ['op_malformed', 'op_success', 'op_success'],
      });
    });
  });

  // ========================================================================
  // Backoff Calculation
  // ========================================================================

  describe('calculateBackoffDelay', () => {
    it('should return 0 for non-retriable errors', () => {
      const classification = {
        errorType: HorizonErrorType.BAD_SIGNATURE,
        retriable: false,
        action: RetryAction.FAIL,
        maxRetries: 0,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      const delay = calculateBackoffDelay(classification, 0);
      expect(delay).toBe(0);
    });

    it('should calculate exponential backoff for attempt 0', () => {
      const classification = {
        errorType: HorizonErrorType.TIMEOUT,
        retriable: true,
        action: RetryAction.RETRY,
        maxRetries: 2,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      const delay = calculateBackoffDelay(classification, 0);
      // Expected: 100 * 2^0 = 100ms
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThan(110); // Allow for 10% jitter
    });

    it('should calculate exponential backoff for attempt 1', () => {
      const classification = {
        errorType: HorizonErrorType.TIMEOUT,
        retriable: true,
        action: RetryAction.RETRY,
        maxRetries: 2,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      const delay = calculateBackoffDelay(classification, 1);
      // Expected: 100 * 2^1 = 200ms
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThan(220);
    });

    it('should calculate exponential backoff for attempt 2', () => {
      const classification = {
        errorType: HorizonErrorType.TIMEOUT,
        retriable: true,
        action: RetryAction.RETRY,
        maxRetries: 2,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      const delay = calculateBackoffDelay(classification, 2);
      // Expected: 100 * 2^2 = 400ms
      expect(delay).toBeGreaterThanOrEqual(400);
      expect(delay).toBeLessThan(440);
    });

    it('should include jitter in backoff calculation', () => {
      const classification = {
        errorType: HorizonErrorType.TIMEOUT,
        retriable: true,
        action: RetryAction.RETRY,
        maxRetries: 2,
        baseBackoffMs: 1000,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      // Run multiple times to verify jitter variation
      const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(classification, 0));
      const unique = new Set(delays);

      // Most delays should be different due to jitter
      expect(unique.size).toBeGreaterThan(1);

      // All should be in range 1000-1100 (1000 * 2^0 + 10% jitter)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThan(1100);
      }
    });
  });

  // ========================================================================
  // Fee Bump Multiplier
  // ========================================================================

  describe('getFeeBumpMultiplier', () => {
    it('should return 1.3 for INSUFFICIENT_FEE', () => {
      const classification = {
        errorType: HorizonErrorType.INSUFFICIENT_FEE,
        retriable: true,
        action: RetryAction.FEE_BUMP_RETRY,
        maxRetries: 2,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      const multiplier = getFeeBumpMultiplier(classification);
      expect(multiplier).toBe(1.3);
    });

    it('should return 1.2 for BAD_SEQ', () => {
      const classification = {
        errorType: HorizonErrorType.BAD_SEQ,
        retriable: true,
        action: RetryAction.FEE_BUMP_RETRY,
        maxRetries: 3,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      const multiplier = getFeeBumpMultiplier(classification);
      expect(multiplier).toBe(1.2);
    });

    it('should return 1.0 for non-fee-bump errors', () => {
      const classification = {
        errorType: HorizonErrorType.TIMEOUT,
        retriable: true,
        action: RetryAction.RETRY,
        maxRetries: 2,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      const multiplier = getFeeBumpMultiplier(classification);
      expect(multiplier).toBe(1.0);
    });
  });

  // ========================================================================
  // Fee Bump Detection
  // ========================================================================

  describe('requiresFeeBump', () => {
    it('should return true for FEE_BUMP_RETRY action', () => {
      const classification = {
        errorType: HorizonErrorType.INSUFFICIENT_FEE,
        retriable: true,
        action: RetryAction.FEE_BUMP_RETRY,
        maxRetries: 2,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      expect(requiresFeeBump(classification)).toBe(true);
    });

    it('should return false for RETRY action', () => {
      const classification = {
        errorType: HorizonErrorType.TIMEOUT,
        retriable: true,
        action: RetryAction.RETRY,
        maxRetries: 2,
        baseBackoffMs: 100,
        backoffMultiplier: 2,
        originalError: new Error('test'),
      };

      expect(requiresFeeBump(classification)).toBe(false);
    });

    it('should return false for FAIL action', () => {
      const classification = {
        errorType: HorizonErrorType.BAD_SIGNATURE,
        retriable: false,
        action: RetryAction.FAIL,
        maxRetries: 0,
        baseBackoffMs: 0,
        backoffMultiplier: 0,
        originalError: new Error('test'),
      };

      expect(requiresFeeBump(classification)).toBe(false);
    });
  });

  // ========================================================================
  // Retry Matrix Consistency
  // ========================================================================

  describe('Retry Matrix Consistency', () => {
    it('should not have retriable=true with FAIL action', () => {
      const errorTypes = [
        HorizonErrorType.BAD_SEQ,
        HorizonErrorType.INSUFFICIENT_FEE,
        HorizonErrorType.NETWORK_ERROR,
        HorizonErrorType.TIMEOUT,
        HorizonErrorType.RATE_LIMITED,
        HorizonErrorType.BAD_SIGNATURE,
        HorizonErrorType.INVALID_OPERATION,
        HorizonErrorType.OTHER,
      ];

      for (const type of errorTypes) {
        const error = {
          response: {
            status: 400,
            data: {
              title: 'Error',
              extras: {
                result_codes: {
                  transaction: type,
                },
              },
            },
          },
        };

        // This is a basic test; actual matrix is defined in horizonErrorClassifier.ts
        const classification = classifyHorizonError(error);

        if (classification.action === RetryAction.FAIL) {
          expect(classification.retriable).toBe(false);
        }
      }
    });
  });
});
