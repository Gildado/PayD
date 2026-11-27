import logger from '../utils/logger.js';

/**
 * Classification of Horizon/RPC errors for structured retry logic.
 * Enables bounded retry with fee-bump support for transient failures.
 */

// ============================================================================
// Error Types
// ============================================================================

export enum HorizonErrorType {
  /** Sequence number is stale; account may have submitted another tx. */
  BAD_SEQ = 'bad_seq',

  /** Transaction fees insufficient for current network conditions. */
  INSUFFICIENT_FEE = 'insufficient_fee',

  /** Generic network error (5xx, timeout, unreachable). */
  NETWORK_ERROR = 'network_error',

  /** Request timeout or connection timeout. */
  TIMEOUT = 'timeout',

  /** Rate limited by Horizon (429). */
  RATE_LIMITED = 'rate_limited',

  /** Transaction signature invalid (non-retriable). */
  BAD_SIGNATURE = 'bad_signature',

  /** Operation or transaction structure invalid (non-retriable). */
  INVALID_OPERATION = 'invalid_operation',

  /** Other Horizon errors (non-retriable unless specified). */
  OTHER = 'other',
}

export enum RetryAction {
  /** Retry with same parameters and exponential backoff. */
  RETRY = 'retry',

  /** Re-estimate fees, bump by 20-30%, and retry. */
  FEE_BUMP_RETRY = 'fee_bump_retry',

  /** Do not retry; fail the transaction. */
  FAIL = 'fail',
}

// ============================================================================
// Classification Result
// ============================================================================

export interface HorizonErrorClassification {
  /** Type of error detected. */
  errorType: HorizonErrorType;

  /** Recommended action. */
  action: RetryAction;

  /** Whether this error can be retried. */
  retriable: boolean;

  /** Maximum retry attempts recommended for this error. */
  maxRetries: number;

  /** Base backoff duration in milliseconds. */
  baseBackoffMs: number;

  /** Backoff multiplier (exponential backoff = attempt * multiplier). */
  backoffMultiplier: number;

  /** Original error or message. */
  originalError: Error | string;

  /** Ledger sequence from error (if available). */
  ledgerSequence?: number;

  /** Original Horizon result codes (tx_failed, etc). */
  resultCodes?: {
    transaction?: string;
    operations?: string[];
  };
}

// ============================================================================
// Retry Matrix
// ============================================================================

/**
 * Retry decision matrix for different error types.
 * Defines retriability, action, and retry limits.
 */
const RETRY_MATRIX: Record<HorizonErrorType, Omit<HorizonErrorClassification, 'originalError' | 'ledgerSequence' | 'resultCodes'>> = {
  [HorizonErrorType.BAD_SEQ]: {
    errorType: HorizonErrorType.BAD_SEQ,
    action: RetryAction.FEE_BUMP_RETRY,
    retriable: true,
    maxRetries: 3,
    baseBackoffMs: 100,
    backoffMultiplier: 2,
  },

  [HorizonErrorType.INSUFFICIENT_FEE]: {
    errorType: HorizonErrorType.INSUFFICIENT_FEE,
    action: RetryAction.FEE_BUMP_RETRY,
    retriable: true,
    maxRetries: 2,
    baseBackoffMs: 100,
    backoffMultiplier: 2,
  },

  [HorizonErrorType.NETWORK_ERROR]: {
    errorType: HorizonErrorType.NETWORK_ERROR,
    action: RetryAction.RETRY,
    retriable: true,
    maxRetries: 3,
    baseBackoffMs: 100,
    backoffMultiplier: 2,
  },

  [HorizonErrorType.TIMEOUT]: {
    errorType: HorizonErrorType.TIMEOUT,
    action: RetryAction.RETRY,
    retriable: true,
    maxRetries: 2,
    baseBackoffMs: 100,
    backoffMultiplier: 2,
  },

  [HorizonErrorType.RATE_LIMITED]: {
    errorType: HorizonErrorType.RATE_LIMITED,
    action: RetryAction.RETRY,
    retriable: true,
    maxRetries: 1,
    baseBackoffMs: 1000, // Start with longer backoff for rate limit
    backoffMultiplier: 2,
  },

  [HorizonErrorType.BAD_SIGNATURE]: {
    errorType: HorizonErrorType.BAD_SIGNATURE,
    action: RetryAction.FAIL,
    retriable: false,
    maxRetries: 0,
    baseBackoffMs: 0,
    backoffMultiplier: 0,
  },

  [HorizonErrorType.INVALID_OPERATION]: {
    errorType: HorizonErrorType.INVALID_OPERATION,
    action: RetryAction.FAIL,
    retriable: false,
    maxRetries: 0,
    baseBackoffMs: 0,
    backoffMultiplier: 0,
  },

  [HorizonErrorType.OTHER]: {
    errorType: HorizonErrorType.OTHER,
    action: RetryAction.FAIL,
    retriable: false,
    maxRetries: 0,
    baseBackoffMs: 0,
    backoffMultiplier: 0,
  },
};

// ============================================================================
// Error Classification Logic
// ============================================================================

/**
 * Classify a Horizon/RPC error and determine retry strategy.
 *
 * @param error - Horizon error from axios or native Error
 * @returns Classification with retry metadata
 */
export function classifyHorizonError(error: any): HorizonErrorClassification {
  let errorType = HorizonErrorType.OTHER;
  let resultCodes: HorizonErrorClassification['resultCodes'] | undefined;
  let ledgerSequence: number | undefined;

  // Extract HTTP status and response data
  const status = error?.response?.status;
  const data = error?.response?.data;
  const message = error?.message || String(error);

  // --------
  // HTTP 429: Rate Limited
  // --------
  if (status === 429) {
    errorType = HorizonErrorType.RATE_LIMITED;
  }
  // --------
  // HTTP 5xx: Network Error
  // --------
  else if (status && status >= 500) {
    errorType = HorizonErrorType.NETWORK_ERROR;
  }
  // --------
  // HTTP 408 or timeout: Timeout
  // --------
  else if (status === 408 || message.includes('timeout') || message.includes('ECONNABORTED')) {
    errorType = HorizonErrorType.TIMEOUT;
  }
  // --------
  // Specific Horizon transaction failures
  // --------
  else if (data?.status === 400) {
    const title = data?.title || '';
    const extras = data?.extras || {};

    // Extract result codes if present
    if (extras.result_codes) {
      resultCodes = extras.result_codes;
    }

    // Parse transaction and operation result codes
    const txResultCode = extras.result_codes?.transaction || '';
    const opResultCodes = extras.result_codes?.operations || [];

    // ---- bad_seq ----
    if (txResultCode === 'tx_bad_seq') {
      errorType = HorizonErrorType.BAD_SEQ;
      ledgerSequence = extras.ledger_attr;
    }
    // ---- insufficient_fee ----
    else if (
      txResultCode === 'tx_insufficient_fee' ||
      title.includes('insufficient fee') ||
      message.includes('insufficient_fee')
    ) {
      errorType = HorizonErrorType.INSUFFICIENT_FEE;
    }
    // ---- bad_signature ----
    else if (txResultCode === 'tx_bad_auth' || txResultCode === 'tx_bad_auth_extra') {
      errorType = HorizonErrorType.BAD_SIGNATURE;
    }
    // ---- invalid_operation ----
    else if (
      txResultCode.startsWith('tx_') &&
      txResultCode !== 'tx_success' &&
      !txResultCode.includes('fee') &&
      !txResultCode.includes('seq')
    ) {
      errorType = HorizonErrorType.INVALID_OPERATION;
    } else if (opResultCodes.some((code: string) => code && code !== 'op_success')) {
      errorType = HorizonErrorType.INVALID_OPERATION;
    }
  }
  // --------
  // Connection errors
  // --------
  else if (
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ENETUNREACH') ||
    error?.code === 'ECONNREFUSED'
  ) {
    errorType = HorizonErrorType.NETWORK_ERROR;
  }

  // Apply retry matrix
  const matrixEntry = RETRY_MATRIX[errorType];
  const classification: HorizonErrorClassification = {
    ...matrixEntry,
    originalError: error instanceof Error ? error : new Error(message),
  };

  if (ledgerSequence) {
    classification.ledgerSequence = ledgerSequence;
  }

  if (resultCodes) {
    classification.resultCodes = resultCodes;
  }

  logger.debug(`Horizon error classified as ${errorType}:`, {
    errorType,
    action: classification.action,
    retriable: classification.retriable,
    maxRetries: classification.maxRetries,
    originalMessage: message,
    status,
  });

  return classification;
}

/**
 * Calculate backoff delay for a given retry attempt.
 * Uses exponential backoff: baseBackoffMs * (backoffMultiplier ^ attempt).
 *
 * @param classification - Error classification with backoff config
 * @param attempt - Zero-indexed retry attempt number (0 = first retry)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  classification: HorizonErrorClassification,
  attempt: number
): number {
  if (!classification.retriable || attempt < 0) {
    return 0;
  }

  const delay = classification.baseBackoffMs * Math.pow(classification.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.1 * delay; // 10% jitter
  return Math.round(delay + jitter);
}

/**
 * Calculate recommended fee bump percentage based on error.
 * Used for fee-bump retries.
 *
 * @param classification - Error classification
 * @returns Percentage to increase fee (e.g., 1.3 = 30% increase)
 */
export function getFeeBumpMultiplier(classification: HorizonErrorClassification): number {
  switch (classification.errorType) {
    case HorizonErrorType.INSUFFICIENT_FEE:
      return 1.3; // Bump by 30%
    case HorizonErrorType.BAD_SEQ:
      return 1.2; // Bump by 20% (also need sequence update)
    default:
      return 1.0; // No fee bump for non-fee errors
  }
}

/**
 * Check if an error requires fee-bump retry (vs standard retry).
 */
export function requiresFeeBump(classification: HorizonErrorClassification): boolean {
  return classification.action === RetryAction.FEE_BUMP_RETRY;
}
