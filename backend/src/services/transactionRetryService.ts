import {
  classifyHorizonError,
  calculateBackoffDelay,
  getFeeBumpMultiplier,
  requiresFeeBump,
  HorizonErrorClassification,
  RetryAction,
  HorizonErrorType,
} from './horizonErrorClassifier.js';
import { idempotencyService } from './idempotencyService.js';
import { getFeeRecommendation } from './feeEstimationService.js';
import logger from '../utils/logger.js';

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Enable retries (default: true). */
  enableRetry?: boolean;

  /** Maximum attempts (includes initial attempt). */
  maxAttempts?: number;

  /** Override matrix maxRetries for all errors. */
  overrideMaxRetries?: number;

  /** Enable fee bump on insufficient_fee errors. */
  enableFeeBump?: boolean;

  /** Idempotency key for deduplication (optional). */
  idempotencyKey?: string;
}

/**
 * Result of a retry attempt.
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded. */
  success: boolean;

  /** Final result or error. */
  result: T | Error;

  /** Number of attempts made. */
  attempts: number;

  /** Detailed attempt history for observability. */
  attemptHistory: AttemptRecord[];

  /** Final classification (if error). */
  finalClassification?: HorizonErrorClassification;
}

/**
 * Record of a single retry attempt.
 */
export interface AttemptRecord {
  /** Attempt number (1-indexed). */
  attempt: number;

  /** Whether this attempt succeeded. */
  success: boolean;

  /** Error encountered (if any). */
  error?: Error;

  /** Classification of error (if applicable). */
  classification?: HorizonErrorClassification;

  /** Backoff delay applied before next attempt (ms). */
  backoffMs?: number;

  /** Fee bump applied (if any). */
  feeBumpMultiplier?: number;

  /** Timestamp of attempt. */
  timestamp: Date;
}

/**
 * Retry context holding state across retry loop.
 */
interface RetryContext<T> {
  config: Required<RetryConfig>;
  history: AttemptRecord[];
  currentFee?: number;
  currentSequence?: number;
  lastClassification?: HorizonErrorClassification;
}

/**
 * Callback signature for retry operations.
 * @param context - Retry context with current fee/sequence info
 * @returns Promise resolving to result or rejecting with error
 */
export type RetryableOperation<T> = (context?: {
  fee?: number;
  sequence?: number;
}) => Promise<T>;

/**
 * Execute a retriable operation with bounded retry and fee-bump support.
 *
 * Usage:
 * ```
 * const result = await executeWithRetry(
 *   async (ctx) => horizonServer.submitTransaction(tx, ctx?.fee),
 *   { enableRetry: true, enableFeeBump: true }
 * );
 * ```
 *
 * @param operation - Async function to retry
 * @param config - Retry configuration
 * @returns Retry result with history
 */
export async function executeWithRetry<T>(
  operation: RetryableOperation<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const finalConfig: Required<RetryConfig> = {
    enableRetry: config.enableRetry ?? true,
    maxAttempts: config.maxAttempts ?? 5,
    overrideMaxRetries: config.overrideMaxRetries ?? 0,
    enableFeeBump: config.enableFeeBump ?? true,
    idempotencyKey: config.idempotencyKey ?? undefined,
  };

  const context: RetryContext<T> = {
    config: finalConfig,
    history: [],
  };

  let lastError: Error | undefined;
  let lastClassification: HorizonErrorClassification | undefined;

  // Check idempotency cache
  if (finalConfig.idempotencyKey) {
    try {
      const cached = await idempotencyService.get(finalConfig.idempotencyKey);
      if (cached) {
        logger.debug(`Idempotency hit for key ${finalConfig.idempotencyKey}`);
        return {
          success: true,
          result: cached as T,
          attempts: 1,
          attemptHistory: [
            {
              attempt: 1,
              success: true,
              timestamp: new Date(),
            },
          ],
        };
      }
    } catch (error) {
      logger.warn('Idempotency lookup failed, proceeding with retry', error);
    }
  }

  // ========================================================================
  // Retry Loop
  // ========================================================================

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    const attemptRecord: AttemptRecord = {
      attempt,
      success: false,
      timestamp: new Date(),
    };

    try {
      logger.debug(`Retry attempt ${attempt}/${finalConfig.maxAttempts}`);

      // Execute operation with current context (fee, sequence)
      const result = await operation({
        fee: context.currentFee,
        sequence: context.currentSequence,
      });

      attemptRecord.success = true;
      context.history.push(attemptRecord);

      // Cache result if idempotency key provided
      if (finalConfig.idempotencyKey) {
        try {
          await idempotencyService.set(finalConfig.idempotencyKey, result, 3600); // 1 hour TTL
        } catch (error) {
          logger.warn('Idempotency caching failed', error);
        }
      }

      logger.debug(`Retry succeeded on attempt ${attempt}`);
      return {
        success: true,
        result,
        attempts: attempt,
        attemptHistory: context.history,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      lastClassification = classifyHorizonError(error);
      attemptRecord.error = lastError;
      attemptRecord.classification = lastClassification;

      // ----
      // Check if we should retry
      // ----

      if (!finalConfig.enableRetry || !lastClassification.retriable) {
        logger.debug(`Error not retriable: ${lastClassification.errorType}`);
        context.history.push(attemptRecord);
        return {
          success: false,
          result: lastError,
          attempts: attempt,
          attemptHistory: context.history,
          finalClassification: lastClassification,
        };
      }

      // Check max retries limit
      const maxRetriesForError = finalConfig.overrideMaxRetries || lastClassification.maxRetries;
      if (attempt >= finalConfig.maxAttempts || attempt > maxRetriesForError) {
        logger.debug(`Max retries reached: ${attempt} >= ${finalConfig.maxAttempts}`);
        context.history.push(attemptRecord);
        return {
          success: false,
          result: lastError,
          attempts: attempt,
          attemptHistory: context.history,
          finalClassification: lastClassification,
        };
      }

      // ----
      // Calculate backoff and prepare for next attempt
      // ----

      const backoffMs = calculateBackoffDelay(lastClassification, attempt - 1);
      attemptRecord.backoffMs = backoffMs;

      // Apply fee bump if needed
      if (finalConfig.enableFeeBump && requiresFeeBump(lastClassification)) {
        const feeBumpMultiplier = getFeeBumpMultiplier(lastClassification);
        if (feeBumpMultiplier > 1.0 && !context.currentFee) {
          // On first fee bump, fetch current recommendation
          try {
            const feeRec = await getFeeRecommendation();
            context.currentFee = Math.ceil(feeRec.recommendedFee * feeBumpMultiplier);
            attemptRecord.feeBumpMultiplier = feeBumpMultiplier;
            logger.debug(`Fee bumped: ${context.currentFee} stroops (${feeBumpMultiplier}x)`);
          } catch (feeError) {
            logger.warn('Fee estimation failed, proceeding with standard retry', feeError);
          }
        } else if (context.currentFee) {
          // Subsequent fee bumps: apply multiplier to current fee
          context.currentFee = Math.ceil(context.currentFee * feeBumpMultiplier);
          attemptRecord.feeBumpMultiplier = feeBumpMultiplier;
        }
      }

      // Update sequence if bad_seq error
      if (lastClassification.errorType === HorizonErrorType.BAD_SEQ) {
        if (lastClassification.ledgerSequence) {
          context.currentSequence = lastClassification.ledgerSequence + 1;
          logger.debug(`Sequence updated to ${context.currentSequence} from bad_seq`);
        }
      }

      context.history.push(attemptRecord);

      // Wait before next attempt
      if (backoffMs > 0) {
        logger.debug(`Backoff ${backoffMs}ms before retry attempt ${attempt + 1}`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // ========================================================================
  // All retries exhausted
  // ========================================================================

  return {
    success: false,
    result: lastError || new Error('Unknown error'),
    attempts: finalConfig.maxAttempts,
    attemptHistory: context.history,
    finalClassification: lastClassification,
  };
}

/**
 * Convenience function: execute with retries and throw on failure.
 * Useful when you don't need detailed retry history.
 */
export async function executeWithRetryOrThrow<T>(
  operation: RetryableOperation<T>,
  config: RetryConfig = {}
): Promise<T> {
  const result = await executeWithRetry(operation, config);

  if (!result.success) {
    const error = result.result instanceof Error ? result.result : new Error(String(result.result));
    logger.error('Retry operation failed after all attempts', {
      attempts: result.attempts,
      finalError: error.message,
      classification: result.finalClassification?.errorType,
    });
    throw error;
  }

  return result.result;
}
