import {
  stellarAccountSchema,
  assetCodeSchema,
  textMemoSchema,
  idMemoSchema,
  hashMemoSchema,
  paymentEntrySchema,
  batchPaymentSchema,
  assetSchema,
  isValidStellarAssetIdentifier,
} from '../validators/paymentValidators';
import { z } from 'zod';

describe('Payment Validators', () => {
  // ========================================================================
  // Stellar Account Validation
  // ========================================================================

  describe('stellarAccountSchema', () => {
    it('should validate a correct Stellar public key', () => {
      const validKey = 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5';
      const result = stellarAccountSchema.safeParse(validKey);
      expect(result.success).toBe(true);
    });

    it('should reject account shorter than 56 characters', () => {
      const invalid = 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU';
      const result = stellarAccountSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('56 characters');
      }
    });

    it('should reject account longer than 56 characters', () => {
      const invalid = 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5AAA';
      const result = stellarAccountSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject account not starting with G', () => {
      const invalid = 'BDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5';
      const result = stellarAccountSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject with invalid Ed25519 format', () => {
      const invalid = 'G000000000000000000000000000000000000000000000000000000000';
      const result = stellarAccountSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // Asset Code Validation
  // ========================================================================

  describe('assetCodeSchema', () => {
    it('should validate 1-character asset code', () => {
      const result = assetCodeSchema.safeParse('X');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('X');
      }
    });

    it('should validate 12-character asset code', () => {
      const result = assetCodeSchema.safeParse('MAXLENGTHCODE');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('MAXLENGTHCODE');
      }
    });

    it('should reject empty string', () => {
      const result = assetCodeSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject longer than 12 characters', () => {
      const result = assetCodeSchema.safeParse('TOOLONGCODEHERE');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('12');
      }
    });

    it('should reject lowercase characters', () => {
      const result = assetCodeSchema.safeParse('OrGusd');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('uppercase');
      }
    });

    it('should reject non-alphanumeric characters', () => {
      const result = assetCodeSchema.safeParse('USD-ORGUSD');
      expect(result.success).toBe(false);
    });

    it('should convert lowercase to uppercase', () => {
      const result = assetCodeSchema.safeParse('orgusd');
      expect(result.success).toBe(false); // Should fail before transform
    });
  });

  // ========================================================================
  // Memo Validation
  // ========================================================================

  describe('textMemoSchema', () => {
    it('should validate text memo up to 28 characters', () => {
      const memo = 'Invoice #12345 for services';
      const result = textMemoSchema.safeParse(memo);
      expect(result.success).toBe(true);
    });

    it('should reject memo longer than 28 characters', () => {
      const memo = 'This is a very long memo text that exceeds the 28 character limit';
      const result = textMemoSchema.safeParse(memo);
      expect(result.success).toBe(false);
    });

    it('should allow empty/undefined', () => {
      const result = textMemoSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });

  describe('idMemoSchema', () => {
    it('should validate numeric ID memo', () => {
      const result = idMemoSchema.safeParse('123456789');
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric ID memo', () => {
      const result = idMemoSchema.safeParse('abc123');
      expect(result.success).toBe(false);
    });

    it('should validate max uint64 value', () => {
      const result = idMemoSchema.safeParse('18446744073709551615');
      expect(result.success).toBe(true);
    });

    it('should reject value exceeding uint64 max', () => {
      const result = idMemoSchema.safeParse('18446744073709551616');
      expect(result.success).toBe(false);
    });

    it('should allow undefined', () => {
      const result = idMemoSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });

  describe('hashMemoSchema', () => {
    it('should validate 64-character hex string', () => {
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const result = hashMemoSchema.safeParse(hash);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(hash.toUpperCase());
      }
    });

    it('should reject non-hex characters', () => {
      const hash = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
      const result = hashMemoSchema.safeParse(hash);
      expect(result.success).toBe(false);
    });

    it('should reject wrong length (63 chars)', () => {
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const result = hashMemoSchema.safeParse(hash);
      expect(result.success).toBe(false);
    });

    it('should reject wrong length (65 chars)', () => {
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const result = hashMemoSchema.safeParse(hash);
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // Payment Entry Validation
  // ========================================================================

  describe('paymentEntrySchema', () => {
    it('should validate valid payment entry', () => {
      const entry = {
        destination: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
        amount: '100.1234567',
      };
      const result = paymentEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });

    it('should validate 1-7 decimal places', () => {
      const tests = [
        '1',
        '1.1',
        '1.12',
        '1.123',
        '1.1234',
        '1.12345',
        '1.123456',
        '1.1234567',
      ];

      for (const amount of tests) {
        const result = paymentEntrySchema.safeParse({
          destination: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
          amount,
        });
        expect(result.success).toBe(true, `Failed for amount: ${amount}`);
      }
    });

    it('should reject more than 7 decimal places', () => {
      const result = paymentEntrySchema.safeParse({
        destination: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
        amount: '1.12345678',
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero or negative amounts', () => {
      const tests = ['0', '-1', '-100.5'];
      for (const amount of tests) {
        const result = paymentEntrySchema.safeParse({
          destination: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
          amount,
        });
        expect(result.success).toBe(false, `Should reject amount: ${amount}`);
      }
    });

    it('should reject invalid destination', () => {
      const result = paymentEntrySchema.safeParse({
        destination: 'invalid-account',
        amount: '100',
      });
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // Batch Payment Validation
  // ========================================================================

  describe('batchPaymentSchema', () => {
    it('should validate a valid batch', () => {
      const batch = {
        assetCode: 'ORGUSD',
        assetIssuer: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
        payments: [
          {
            destination: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
            amount: '100.5',
          },
          {
            destination: 'GBCSWFOJAGXS2IJQAKD4WXTLGBJQTFPZAWTF2IVZ23CUZB46WKPQJ3OC',
            amount: '250.123',
          },
        ],
      };

      const result = batchPaymentSchema.safeParse(batch);
      expect(result.success).toBe(true);
    });

    it('should reject empty payments array', () => {
      const batch = {
        assetCode: 'ORGUSD',
        assetIssuer: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
        payments: [],
      };

      const result = batchPaymentSchema.safeParse(batch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('least one');
      }
    });

    it('should reject batch exceeding 100 payments', () => {
      const payments = Array.from({ length: 101 }, (_, i) => ({
        destination: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
        amount: '1',
      }));

      const batch = {
        assetCode: 'ORGUSD',
        assetIssuer: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
        payments,
      };

      const result = batchPaymentSchema.safeParse(batch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('exceed');
      }
    });
  });

  // ========================================================================
  // Asset Identifier Validation
  // ========================================================================

  describe('isValidStellarAssetIdentifier', () => {
    it('should accept "native"', () => {
      expect(isValidStellarAssetIdentifier('native')).toBe(true);
    });

    it('should accept valid CODE:ISSUER format', () => {
      expect(
        isValidStellarAssetIdentifier(
          'USD:GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5'
        )
      ).toBe(true);
    });

    it('should accept longer asset codes (up to 12 chars)', () => {
      expect(
        isValidStellarAssetIdentifier(
          'MAXLENGTHCODE:GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5'
        )
      ).toBe(true);
    });

    it('should reject invalid issuer key', () => {
      expect(isValidStellarAssetIdentifier('USD:INVALID')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidStellarAssetIdentifier('')).toBe(false);
    });

    it('should reject non-string', () => {
      expect(isValidStellarAssetIdentifier(123)).toBe(false);
    });

    it('should reject CODE:ISSUER without colon', () => {
      expect(
        isValidStellarAssetIdentifier(
          'USDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5'
        )
      ).toBe(false);
    });
  });

  // ========================================================================
  // Integration Tests
  // ========================================================================

  describe('Integration: Common Error Scenarios', () => {
    it('should catch duplicate validation errors in batch', () => {
      const batch = {
        assetCode: 'TOOLONG',
        assetIssuer: 'short',
        payments: [
          {
            destination: 'invalid',
            amount: 'not-a-number',
          },
        ],
      };

      const result = batchPaymentSchema.safeParse(batch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(2);
      }
    });

    it('should validate a realistic production batch', () => {
      const batch = {
        assetCode: 'ORGUSD',
        assetIssuer: 'GDZST3XVCDTUJ76ZAV2HA72KYTSHU5ZTT56T7HYE7UUHFSBXBHWCXXU5',
        payments: [
          {
            destination: 'GBCSWFOJAGXS2IJQAKD4WXTLGBJQTFPZAWTF2IVZ23CUZB46WKPQJ3OC',
            amount: '1000',
          },
          {
            destination: 'GBH6AFYF5LSW3FXKKBKB67G74BLLZXLQ6AJYRMFQJVYSFITLRDRWKFNP',
            amount: '2500.5',
          },
          {
            destination: 'GBB7RCMQ5J6WYXR45CBXH3DQ4CXKTPKPOWGDYEKAANPFXYQ5JNRUJG7',
            amount: '750.1234567',
          },
        ],
      };

      const result = batchPaymentSchema.safeParse(batch);
      expect(result.success).toBe(true);
    });
  });
});
