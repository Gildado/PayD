import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

/**
 * Shared Zod refinements and schemas for payment processing.
 * Used across trustlineController, bulkPaymentController, and paymentController.
 */

// ============================================================================
// Asset Identifier Validation
// ============================================================================

/**
 * Validates Stellar asset identifiers in "CODE:ISSUER" or "native" format.
 * Used by pathfinding and cross-asset payment operations.
 */
const STELLAR_ASSET_REGEX = /^(native|[A-Z0-9]{1,12}:G[A-Z2-7]{55})$/;

export function isValidStellarAssetIdentifier(asset: unknown): asset is string {
  return typeof asset === 'string' && STELLAR_ASSET_REGEX.test(asset);
}

// ============================================================================
// Stellar Account Validation
// ============================================================================

/**
 * Validates a Stellar public account key (G-prefixed, 56 characters, Ed25519).
 * This refinement ensures the account is properly formatted before submission.
 */
export const stellarAccountSchema = z
  .string()
  .length(56, 'Stellar account must be 56 characters')
  .refine(
    (value) => StrKey.isValidEd25519PublicKey(value),
    { message: 'Invalid Stellar public account key (must be valid Ed25519)' }
  );

/**
 * Optional Stellar account (for fields that can be omitted or resolved elsewhere).
 */
export const optionalStellarAccountSchema = stellarAccountSchema.optional();

// ============================================================================
// Asset Code Validation
// ============================================================================

/**
 * Validates a Stellar asset code (1-12 uppercase alphanumeric characters).
 * Reference: https://developers.stellar.org/docs/issuing-assets/anatomy-of-an-asset
 */
export const assetCodeSchema = z
  .string()
  .min(1, 'Asset code must be at least 1 character')
  .max(12, 'Asset code must be at most 12 characters')
  .regex(/^[A-Z0-9]+$/, 'Asset code must be uppercase alphanumeric')
  .transform((v) => v.toUpperCase());

/**
 * Optional asset code (defaults can be applied by caller).
 */
export const optionalAssetCodeSchema = assetCodeSchema.optional();

// ============================================================================
// Memo Validation
// ============================================================================

/**
 * Text memo: 1-28 bytes UTF-8 string.
 * Per Stellar spec: https://developers.stellar.org/docs/glossary/memos
 */
export const textMemoSchema = z
  .string()
  .max(28, 'Text memo must be at most 28 characters')
  .optional();

/**
 * ID memo: unsigned 64-bit integer (as string for safety).
 */
export const idMemoSchema = z
  .string()
  .regex(/^\d+$/, 'ID memo must be numeric')
  .refine((v) => {
    const num = BigInt(v);
    return num >= 0n && num <= 18446744073709551615n;
  }, 'ID memo must fit in unsigned 64-bit integer')
  .optional();

/**
 * Hash memo: 32-byte hex string (64 hex characters) or Buffer.
 */
export const hashMemoSchema = z
  .string()
  .length(64, 'Hash memo must be exactly 64 hex characters')
  .regex(/^[0-9a-fA-F]{64}$/, 'Hash memo must be valid hexadecimal')
  .transform((v) => v.toUpperCase())
  .optional();

/**
 * Return memo: 32-byte hex string (same as hash memo).
 */
export const returnMemoSchema = hashMemoSchema;

/**
 * Union of all supported memo types.
 * Discriminated by memo_type field if used in a larger schema.
 */
export const memoSchema = z.union([
  z.object({ type: z.literal('text'), value: textMemoSchema }),
  z.object({ type: z.literal('id'), value: idMemoSchema }),
  z.object({ type: z.literal('hash'), value: hashMemoSchema }),
  z.object({ type: z.literal('return'), value: returnMemoSchema }),
  z.object({ type: z.literal('none') }),
]).optional();

// ============================================================================
// Asset Definition (Code + Issuer)
// ============================================================================

/**
 * Complete asset specification: code and issuer account.
 * Used for identifying assets in payment operations.
 */
export const assetSchema = z.object({
  assetCode: assetCodeSchema,
  assetIssuer: stellarAccountSchema,
});

/**
 * Asset with optional issuer (issuer may be resolved from config).
 */
export const assetWithOptionalIssuerSchema = z.object({
  assetCode: assetCodeSchema,
  assetIssuer: optionalStellarAccountSchema,
});

// ============================================================================
// Payment Entry Validation
// ============================================================================

/**
 * Individual payment in a batch: destination account and XLM amount.
 * Amount is a string to preserve precision (no float rounding).
 */
export const paymentEntrySchema = z.object({
  destination: stellarAccountSchema,
  amount: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^\d+(\.\d{1,7})?$/, 'Amount must be a valid XLM value (1-7 decimals)')
    .refine(
      (v) => {
        const num = parseFloat(v);
        return num > 0 && num <= 922337203685.4775;
      },
      'Amount must be positive and not exceed maximum (922337203685.4775 XLM)'
    ),
});

/**
 * Optional destination for conditional validation scenarios.
 */
export const optionalPaymentEntrySchema = paymentEntrySchema.partial();

// ============================================================================
// Batch Payment Schema
// ============================================================================

/**
 * Batch of payments with shared asset and issuer.
 * Used in bulkPaymentController.submitBatch().
 */
export const batchPaymentSchema = z.object({
  assetCode: assetCodeSchema,
  assetIssuer: stellarAccountSchema,
  payments: z
    .array(paymentEntrySchema)
    .min(1, 'Batch must contain at least one payment')
    .max(100, 'Batch cannot exceed 100 payments for performance'),
});

// ============================================================================
// SEP-31 Payment Data
// ============================================================================

/**
 * SEP-31 compliant payment data for anchor transactions.
 * Subset of fields required by anchor protocol.
 */
export const sep31PaymentDataSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^\d+(\.\d+)?$/, 'Amount must be a positive decimal string'),
  asset_code: assetCodeSchema,
  receiver_id: z.string().min(1, 'Receiver ID is required').max(256),
});

// ============================================================================
// Trustline Operations
// ============================================================================

/**
 * Trustline establishment request: account and asset.
 */
export const trustlineRequestSchema = z.object({
  walletAddress: stellarAccountSchema,
  assetCode: assetCodeSchema,
  assetIssuer: optionalStellarAccountSchema,
});

/**
 * Trustline state check with optional asset override.
 */
export const trustlineCheckSchema = z.object({
  assetCode: assetCodeSchema.default('ORGUSD'),
  assetIssuer: optionalStellarAccountSchema,
});

// ============================================================================
// Export Inferred Types
// ============================================================================

export type StellarAccount = z.infer<typeof stellarAccountSchema>;
export type AssetCode = z.infer<typeof assetCodeSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type PaymentEntry = z.infer<typeof paymentEntrySchema>;
export type BatchPayment = z.infer<typeof batchPaymentSchema>;
export type Sep31PaymentData = z.infer<typeof sep31PaymentDataSchema>;
export type TrustlineRequest = z.infer<typeof trustlineRequestSchema>;
export type TrustlineCheck = z.infer<typeof trustlineCheckSchema>;
export type Memo = z.infer<typeof memoSchema>;
