import { describe, expect, test } from 'vitest';
import {
  appendPartialSigningHint,
  isLikelyPartialSigningOrMultisigAuth,
} from '../utils/signingErrors';

describe('signingErrors', () => {
  test('detects common multisig / auth failure phrases', () => {
    expect(isLikelyPartialSigningOrMultisigAuth('Transaction failed: tx_bad_auth')).toBe(true);
    expect(isLikelyPartialSigningOrMultisigAuth('op_bad_auth_extra signers')).toBe(true);
    expect(isLikelyPartialSigningOrMultisigAuth('insufficient fee')).toBe(false);
  });

  test('appendPartialSigningHint adds guidance without duplicating hints', () => {
    const enhanced = appendPartialSigningHint('failed tx_bad_auth');
    expect(enhanced).toContain('multisig');
    expect(appendPartialSigningHint('multisig already mentioned')).toBe(
      'multisig already mentioned'
    );
    expect(appendPartialSigningHint('random failure')).toBe('random failure');
  });
});
