import { describe, it, expect } from 'vitest';
import { isLikelyPartialSigningOrMultisigAuth, appendPartialSigningHint } from '../signingErrors';

describe('signingErrors utils', () => {
  describe('isLikelyPartialSigningOrMultisigAuth', () => {
    it('returns true for common auth failure messages', () => {
      expect(isLikelyPartialSigningOrMultisigAuth('tx_bad_auth')).toBe(true);
      expect(isLikelyPartialSigningOrMultisigAuth('op_bad_auth')).toBe(true);
      expect(isLikelyPartialSigningOrMultisigAuth('Additional signature required')).toBe(true);
      expect(isLikelyPartialSigningOrMultisigAuth('Low signature weight')).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isLikelyPartialSigningOrMultisigAuth('insufficient balance')).toBe(false);
      expect(isLikelyPartialSigningOrMultisigAuth('timeout')).toBe(false);
    });
  });

  describe('appendPartialSigningHint', () => {
    it('appends a hint to auth-related errors', () => {
      const msg = 'op_bad_auth';
      const result = appendPartialSigningHint(msg);
      expect(result).toContain(msg);
      expect(result).toContain('collect the required signatures');
    });

    it('does not append a hint if one already exists', () => {
      const msg = 'multisig error: additional signature needed';
      const result = appendPartialSigningHint(msg);
      expect(result).toBe(msg);
    });

    it('returns original message for non-auth errors', () => {
      const msg = 'generic error';
      const result = appendPartialSigningHint(msg);
      expect(result).toBe(msg);
    });
  });
});
