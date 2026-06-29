import logger from './logger.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

const CONNECTION_ERROR_PATTERNS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'SOCKET_TIMEOUT',
  'Connection refused',
  'Connection reset',
  'Connection terminated',
  'Socket hang up',
  'network timeout',
  'Network request failed',
];

function isConnectionError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return CONNECTION_ERROR_PATTERNS.some((pattern) =>
    message.includes(pattern.toLowerCase())
  );
}

function isRetryableError(error: Error, retryableErrors?: string[]): boolean {
  if (isConnectionError(error)) {
    return true;
  }

  if (retryableErrors && retryableErrors.length > 0) {
    return retryableErrors.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  return false;
}

function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>>
): number {
  const delay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, options.maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retriesOrOptions?: number | RetryOptions,
  delayMs?: number
): Promise<T> {
  let opts: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> & Pick<RetryOptions, 'retryableErrors' | 'onRetry'>;

  if (typeof retriesOrOptions === 'number') {
    opts = {
      ...DEFAULT_RETRY_OPTIONS,
      maxRetries: retriesOrOptions,
      baseDelayMs: delayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs,
    };
  } else {
    opts = { ...DEFAULT_RETRY_OPTIONS, ...retriesOrOptions };
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries) {
        break;
      }

      if (!isRetryableError(lastError, opts.retryableErrors)) {
        throw lastError;
      }

      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError);
      } else {
        logger.warn(
          `[Retry] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed: ${lastError.message}. ` +
          `Retrying in ${calculateDelay(attempt, opts)}ms...`
        );
      }

      const delay = calculateDelay(attempt, opts);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry mechanism failed');
}

export async function withConnectionRetry<T>(
  fn: () => Promise<T>,
  options?: Omit<RetryOptions, 'retryableErrors'>
): Promise<T> {
  return withRetry(fn, {
    ...options,
    retryableErrors: CONNECTION_ERROR_PATTERNS,
  });
}
