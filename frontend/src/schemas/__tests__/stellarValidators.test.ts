import { describe, expect, it } from 'vitest';
import {
  STELLAR_MAX_AMOUNT,
  STELLAR_MAX_DECIMAL_PLACES,
  STELLAR_MEMO_MAX_BYTES,
  countDecimalPlaces,
  getUtf8ByteLength,
  isValidStellarPublicKey,
  isValidStellarSecretKey,
  optionalStellarAmountSchema,
  optionalStellarMemoSchema,
  optionalStellarPublicKeySchema,
  stellarAmountSchema,
  stellarMemoSchema,
  stellarPublicKeySchema,
  stellarSecretKeySchema,
  validateStellarAmount,
  validateStellarMemo,
  validateStellarPublicKey,
} from '../stellarValidators';

const VALID_PUBLIC_KEY = 'G' + 'B'.repeat(55);
const VALID_SECRET_KEY = 'S' + 'A'.repeat(55);

describe('Stellar Public Key Validation', () => {
  it('accepts a valid 56-character G-address', () => {
    expect(isValidStellarPublicKey(VALID_PUBLIC_KEY)).toBe(true);
    expect(validateStellarPublicKey(VALID_PUBLIC_KEY)).toBeNull();
    expect(stellarPublicKeySchema.safeParse(VALID_PUBLIC_KEY).success).toBe(true);
  });

  it('rejects public keys not starting with G', () => {
    const invalid = 'C' + 'B'.repeat(55);
    expect(isValidStellarPublicKey(invalid)).toBe(false);
    expect(validateStellarPublicKey(invalid)).toBe('Invalid Stellar wallet address format');
    expect(stellarPublicKeySchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects public keys with invalid length (< 56 or > 56)', () => {
    expect(validateStellarPublicKey('GBBBBB')).toBe('Invalid Stellar wallet address format');
    expect(validateStellarPublicKey('G' + 'B'.repeat(60))).toBe(
      'Invalid Stellar wallet address format'
    );
  });

  it('rejects forbidden base32 characters (0, 1, 8, 9)', () => {
    expect(isValidStellarPublicKey('G0' + 'B'.repeat(54))).toBe(false);
    expect(isValidStellarPublicKey('G1' + 'B'.repeat(54))).toBe(false);
    expect(isValidStellarPublicKey('G8' + 'B'.repeat(54))).toBe(false);
    expect(isValidStellarPublicKey('G9' + 'B'.repeat(54))).toBe(false);
  });

  it('handles optional public keys correctly', () => {
    expect(validateStellarPublicKey('', true)).toBeNull();
    expect(validateStellarPublicKey('   ', true)).toBeNull();
    expect(optionalStellarPublicKeySchema.safeParse('').success).toBe(true);
    expect(optionalStellarPublicKeySchema.safeParse(VALID_PUBLIC_KEY).success).toBe(true);
    expect(optionalStellarPublicKeySchema.safeParse('invalid').success).toBe(false);
  });

  it('requires a public key when not optional', () => {
    expect(validateStellarPublicKey('')).toBe('Stellar wallet address is required');
  });
});

describe('Stellar Secret Key Validation', () => {
  it('accepts a valid S-prefixed 56-character seed', () => {
    expect(isValidStellarSecretKey(VALID_SECRET_KEY)).toBe(true);
    expect(stellarSecretKeySchema.safeParse(VALID_SECRET_KEY).success).toBe(true);
  });

  it('rejects secret keys not starting with S', () => {
    expect(isValidStellarSecretKey(VALID_PUBLIC_KEY)).toBe(false);
  });

  it('accepts empty string for optional secret key schema', () => {
    expect(stellarSecretKeySchema.safeParse('').success).toBe(true);
  });
});

describe('Stellar Memo Validation', () => {
  it('accepts empty or undefined memo', () => {
    expect(validateStellarMemo('')).toBeNull();
    expect(validateStellarMemo(undefined)).toBeNull();
    expect(optionalStellarMemoSchema.safeParse('').success).toBe(true);
    expect(optionalStellarMemoSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts a memo within 28 bytes', () => {
    const memo = 'Payroll Nov 2026';
    expect(getUtf8ByteLength(memo)).toBeLessThanOrEqual(STELLAR_MEMO_MAX_BYTES);
    expect(validateStellarMemo(memo)).toBeNull();
    expect(stellarMemoSchema.safeParse(memo).success).toBe(true);
  });

  it('accepts a memo of exactly 28 bytes', () => {
    const exactMemo = 'a'.repeat(28);
    expect(getUtf8ByteLength(exactMemo)).toBe(28);
    expect(validateStellarMemo(exactMemo)).toBeNull();
    expect(stellarMemoSchema.safeParse(exactMemo).success).toBe(true);
  });

  it('rejects a memo exceeding 28 bytes', () => {
    const longMemo = 'a'.repeat(29);
    expect(validateStellarMemo(longMemo)).toContain('cannot exceed 28 bytes');
    expect(stellarMemoSchema.safeParse(longMemo).success).toBe(false);
  });

  it('correctly calculates multibyte UTF-8 characters', () => {
    // 🚀 is 4 bytes in UTF-8
    const emojiMemo = 'Payroll 🚀🚀🚀🚀🚀🚀'; // 8 + 6*4 = 32 bytes
    expect(getUtf8ByteLength(emojiMemo)).toBe(32);
    expect(validateStellarMemo(emojiMemo)).toContain('cannot exceed 28 bytes');
  });
});

describe('Stellar Amount Validation & Precision', () => {
  it('counts decimal places accurately', () => {
    expect(countDecimalPlaces('100')).toBe(0);
    expect(countDecimalPlaces('100.5')).toBe(1);
    expect(countDecimalPlaces('100.1234567')).toBe(7);
    expect(countDecimalPlaces('100.12345678')).toBe(8);
  });

  it('accepts whole numbers', () => {
    expect(validateStellarAmount('500')).toBeNull();
    expect(stellarAmountSchema.safeParse('500').success).toBe(true);
  });

  it('accepts up to exactly 7 decimal places (edge case)', () => {
    const amount7 = '123.1234567';
    expect(validateStellarAmount(amount7)).toBeNull();
    expect(stellarAmountSchema.safeParse(amount7).success).toBe(true);
  });

  it('rejects 8 decimal places (edge case)', () => {
    const amount8 = '123.12345678';
    const err = validateStellarAmount(amount8);
    expect(err).toContain(`at most ${STELLAR_MAX_DECIMAL_PLACES} decimal places`);
    expect(stellarAmountSchema.safeParse(amount8).success).toBe(false);
  });

  it('rejects zero amount for required payment', () => {
    expect(validateStellarAmount('0')).toBe('Amount must be a positive number');
    expect(validateStellarAmount('0.00')).toBe('Amount must be a positive number');
    expect(stellarAmountSchema.safeParse('0').success).toBe(false);
  });

  it('rejects negative numbers', () => {
    expect(validateStellarAmount('-10.50')).toBe('Amount must be a positive number');
    expect(stellarAmountSchema.safeParse('-10.50').success).toBe(false);
  });

  it('rejects non-numeric values', () => {
    expect(validateStellarAmount('not-a-number')).toBe('Amount must be a positive number');
    expect(validateStellarAmount('NaN')).toBe('Amount must be a positive number');
    expect(validateStellarAmount('Infinity')).toBe('Amount must be a positive number');
  });

  it('accepts maximum Stellar int64 stroop amount (edge case)', () => {
    const maxStr = String(STELLAR_MAX_AMOUNT);
    expect(validateStellarAmount(maxStr)).toBeNull();
    expect(stellarAmountSchema.safeParse(maxStr).success).toBe(true);
  });

  it('rejects amount exceeding maximum Stellar amount (edge case)', () => {
    const tooLarge = '1000000000000.00'; // 1 trillion > 922 billion
    expect(validateStellarAmount(tooLarge)).toContain('cannot exceed maximum Stellar amount');
    expect(stellarAmountSchema.safeParse(tooLarge).success).toBe(false);
  });

  it('supports optional amounts (e.g. salary fields)', () => {
    expect(validateStellarAmount('', { optional: true })).toBeNull();
    expect(validateStellarAmount('   ', { optional: true })).toBeNull();
    expect(optionalStellarAmountSchema.safeParse('').success).toBe(true);
    expect(optionalStellarAmountSchema.safeParse('100.50').success).toBe(true);
    expect(optionalStellarAmountSchema.safeParse('100.12345678').success).toBe(false);
  });
});

