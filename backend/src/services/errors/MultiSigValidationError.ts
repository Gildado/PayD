/**
 * MultiSigValidationError
 * 
 * Thrown when a multi-signature transaction fails validation checks:
 * - Insufficient signature weight to meet threshold
 * - Duplicate signatures from the same key
 * - Invalid threshold configuration
 */

export type MultiSigErrorCode = 
  | 'INSUFFICIENT_WEIGHT'
  | 'DUPLICATE_SIGNATURES'
  | 'INVALID_THRESHOLD'
  | 'INVALID_SIGNER';

export interface MultiSigErrorMetadata {
  required?: number;
  actual?: number;
  threshold?: 'low' | 'med' | 'high';
  duplicates?: string[];
  missing?: string[];
  signers?: Array<{
    publicKey: string;
    weight: number;
    signed: boolean;
  }>;
  invalidSigners?: string[];
}

export class MultiSigValidationError extends Error {
  public readonly code: MultiSigErrorCode;
  public readonly metadata: MultiSigErrorMetadata;

  constructor(
    code: MultiSigErrorCode,
    message: string,
    metadata: MultiSigErrorMetadata = {}
  ) {
    super(message);
    this.name = 'MultiSigValidationError';
    this.code = code;
    this.metadata = metadata;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, MultiSigValidationError.prototype);
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
