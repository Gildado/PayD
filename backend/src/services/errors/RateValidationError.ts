/**
 * RateValidationError
 * 
 * Thrown when FX rates fail validation checks:
 * - Rates are stale (exceeding max age)
 * - Rate values are invalid or non-finite
 * - Rate changes exceed acceptable deviation threshold
 */

export type RateValidationErrorCode = 
  | 'STALE_RATE'
  | 'INVALID_RATE'
  | 'OUTLIER_DETECTED';

export interface RateValidationErrorMetadata {
  provider?: string;
  fetchedAt?: string;
  maxAge?: number;
  actualAge?: number;
  deviation?: number;
  maxDeviation?: number;
  currency?: string;
  invalidCurrencies?: string[];
  anomalies?: Array<{
    reason: string;
    description: string;
  }>;
}

export class RateValidationError extends Error {
  public readonly code: RateValidationErrorCode;
  public readonly metadata: RateValidationErrorMetadata;

  constructor(
    code: RateValidationErrorCode,
    message: string,
    metadata: RateValidationErrorMetadata = {}
  ) {
    super(message);
    this.name = 'RateValidationError';
    this.code = code;
    this.metadata = metadata;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, RateValidationError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      metadata: this.metadata,
    };
  }
}
