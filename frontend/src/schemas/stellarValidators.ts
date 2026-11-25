/**
 * Shared Stellar Zod Validators and Precision Helpers
 *
 * Implements centralized, production-grade validation for:
 * - Stellar Public Keys (G-addresses, 56-character RFC4648 base32)
 * - Stellar Secret Keys (S-seeds, 56-character RFC4648 base32)
 * - Stellar Memos (max 28 UTF-8 bytes for MEMO_TEXT)
 * - Stellar Amounts (positive finite numbers, up to 7 decimal places, max int64 stroops)
 *
 * Issue: https://github.com/Gildado/PayD/issues/1842
 */

import { z } from 'zod';

/**
 * Stellar StrKey-encoded G-address:
 * RFC4648 base32 with restricted alphabet (A-Z and 2-7 only; 0, 1, 8, 9 are excluded).
 * Always starts with "G" and is exactly 56 characters long.
 */
export const STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;

/**
 * Stellar secret key / seed:
 * Starts with "S" and is exactly 56 characters long.
 */
export const STELLAR_SECRET_KEY_PATTERN = /^S[A-Z2-7]{55}$/;

/**
 * Stellar represents on-chain amounts with up to 7 decimal places of precision (stroops).
 * 1 XLM = 10,000,000 stroops (10^7).
 */
export const STELLAR_MAX_DECIMAL_PLACES = 7;

/**
 * Maximum possible value in stroops is int64 max: 9,223,372,036,854,775,807 stroops,
 * which equates to 922,337,203,685.4775807 tokens on Stellar.
 */
export const STELLAR_MAX_AMOUNT = 922337203685.4775807;

/**
 * Maximum byte length for Stellar text memo (MEMO_TEXT) under SEP-0001 / Stellar protocol.
 */
export const STELLAR_MEMO_MAX_BYTES = 28;

/**
 * Calculates the UTF-8 byte length for a given string.
 * Accurately accounts for multibyte unicode characters (e.g., emojis, accents).
 *
 * Time Complexity: O(L) where L is string length.
 * Space Complexity: O(1) auxiliary memory.
 */
export function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  // Node.js fallback
  return Buffer.from(str, 'utf8').length;
}

/**
 * Counts the number of decimal digits after the decimal point.
 *
 * Time Complexity: O(L) where L is string length.
 * Space Complexity: O(1).
 */
export function countDecimalPlaces(value: string): number {
  const trimmed = value.trim();
  const dotIndex = trimmed.indexOf('.');
  if (dotIndex === -1) return 0;
  return trimmed.length - dotIndex - 1;
}

/**
 * Checks whether a string is a valid Stellar G-address.
 */
export function isValidStellarPublicKey(address: string): boolean {
  return STELLAR_PUBLIC_KEY_PATTERN.test(address.trim());
}

/**
 * Checks whether a string is a valid Stellar S-seed.
 */
export function isValidStellarSecretKey(secret: string): boolean {
  return STELLAR_SECRET_KEY_PATTERN.test(secret.trim());
}

/**
 * Validates a Stellar G-address, returning an error message if invalid, or null if valid.
 */
export function validateStellarPublicKey(address?: string | null, optional = false): string | null {
  const trimmed = address?.trim() ?? '';
  if (!trimmed) {
    return optional ? null : 'Stellar wallet address is required';
  }
  if (!STELLAR_PUBLIC_KEY_PATTERN.test(trimmed)) {
    return 'Invalid Stellar wallet address format';
  }
  return null;
}

/**
 * Validates a Stellar memo, returning an error message if it exceeds 28 bytes, or null if valid.
 */
export function validateStellarMemo(memo?: string | null): string | null {
  if (!memo || !memo.trim()) return null;
  const byteLength = getUtf8ByteLength(memo);
  if (byteLength > STELLAR_MEMO_MAX_BYTES) {
    return `Memo cannot exceed ${STELLAR_MEMO_MAX_BYTES} bytes (currently ${byteLength} bytes)`;
  }
  return null;
}

/**
 * Validates a payment or salary amount against Stellar ledger constraints:
 * - Must be numeric and finite
 * - Must be strictly positive (> 0) unless optional and empty
 * - Must not exceed 7 decimal places
 * - Must not exceed maximum Stellar int64 limit
 */
export function validateStellarAmount(
  value?: string | null,
  options?: { optional?: boolean; fieldName?: string; maxAmount?: number }
): string | null {
  const trimmed = value?.trim() ?? '';
  const fieldName = options?.fieldName || 'Amount';

  if (!trimmed) {
    return options?.optional ? null : `${fieldName} is required`;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return `${fieldName} must be a positive number`;
  }

  if (countDecimalPlaces(trimmed) > STELLAR_MAX_DECIMAL_PLACES) {
    return `${fieldName} supports at most ${STELLAR_MAX_DECIMAL_PLACES} decimal places`;
  }

  const max = options?.maxAmount ?? STELLAR_MAX_AMOUNT;
  if (parsed > max) {
    return `${fieldName} cannot exceed maximum Stellar amount (${max.toLocaleString()})`;
  }

  return null;
}

/**
 * Zod schema for a required Stellar public key (G-address).
 */
export const stellarPublicKeySchema = z
  .string()
  .transform((val) => val.trim())
  .refine((val) => STELLAR_PUBLIC_KEY_PATTERN.test(val), {
    message: 'Invalid Stellar wallet address format',
  });

/**
 * Zod schema for an optional Stellar public key (accepts empty string or valid G-address).
 */
export const optionalStellarPublicKeySchema = z
  .string()
  .transform((val) => val.trim())
  .refine((val) => val === '' || STELLAR_PUBLIC_KEY_PATTERN.test(val), {
    message: 'Invalid Stellar wallet address format',
  });

/**
 * Zod schema for an optional Stellar secret key (accepts empty string or valid S-seed).
 */
export const stellarSecretKeySchema = z
  .string()
  .transform((val) => val.trim())
  .refine((val) => val === '' || STELLAR_SECRET_KEY_PATTERN.test(val), {
    message: 'Invalid Stellar secret key format (must start with S, 56 chars)',
  });

/**
 * Zod schema for a Stellar text memo (up to 28 UTF-8 bytes).
 */
export const stellarMemoSchema = z
  .string()
  .refine((val) => getUtf8ByteLength(val) <= STELLAR_MEMO_MAX_BYTES, {
    message: `Memo cannot exceed ${STELLAR_MEMO_MAX_BYTES} bytes`,
  });

/**
 * Zod schema for an optional Stellar text memo.
 */
export const optionalStellarMemoSchema = z
  .string()
  .optional()
  .refine((val) => !val || getUtf8ByteLength(val) <= STELLAR_MEMO_MAX_BYTES, {
    message: `Memo cannot exceed ${STELLAR_MEMO_MAX_BYTES} bytes`,
  });

/**
 * Zod schema for a required Stellar payment amount (positive, max 7 decimal places).
 */
export const stellarAmountSchema = z
  .string()
  .transform((val) => val.trim())
  .superRefine((val, ctx) => {
    const error = validateStellarAmount(val);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });

/**
 * Zod schema for an optional Stellar amount (e.g. employee salary).
 */
export const optionalStellarAmountSchema = z
  .string()
  .transform((val) => val.trim())
  .superRefine((val, ctx) => {
    const error = validateStellarAmount(val, { optional: true, fieldName: 'Salary' });
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });

