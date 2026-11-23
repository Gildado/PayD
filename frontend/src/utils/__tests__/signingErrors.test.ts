import { describe, it, expect } from 'vitest';
import i18n from '../../i18n';
import {
  isLikelyPartialSigningOrMultisigAuth,
  appendPartialSigningHint,
  classifySigningError,
  mapSigningError,
  isWalletNetworkMismatch,
} from '../signingErrors';

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

  describe('classifySigningError & mapSigningError', () => {
    it('classifies user-rejected errors', () => {
      expect(classifySigningError(new Error('User declined access'))).toBe('user_rejected');
      expect(classifySigningError('Request rejected by user')).toBe('user_rejected');
      const mapped = mapSigningError(new Error('User cancelled'), i18n.t.bind(i18n));
      expect(mapped.category).toBe('user_rejected');
      expect(mapped.message).toMatch(/cancelled in your wallet/i);
    });

    it('classifies locked-wallet errors', () => {
      expect(classifySigningError(new Error('Wallet is locked'))).toBe('locked_wallet');
      expect(classifySigningError('Please unlock your wallet')).toBe('locked_wallet');
      const mapped = mapSigningError(new Error('Wallet is locked'), i18n.t.bind(i18n));
      expect(mapped.category).toBe('locked_wallet');
      expect(mapped.message).toMatch(/unlock your wallet/i);
    });

    it('classifies network-mismatch errors', () => {
      expect(classifySigningError(new Error('Network mismatch: wallet on TESTNET'))).toBe(
        'network_mismatch'
      );
      expect(classifySigningError('Wrong network selected')).toBe('network_mismatch');
      const mapped = mapSigningError(new Error('Network passphrase mismatch'), i18n.t.bind(i18n));
      expect(mapped.category).toBe('network_mismatch');
      expect(mapped.message).toMatch(/different Stellar network/i);
    });

    it('supports Spanish (es) translations for mapped errors', async () => {
      const prevLng = i18n.language;
      await i18n.changeLanguage('es');
      try {
        expect(mapSigningError(new Error('User declined'), i18n.t.bind(i18n)).message).toMatch(
          /se canceló en tu billetera/i
        );
        expect(mapSigningError(new Error('Wallet is locked'), i18n.t.bind(i18n)).message).toMatch(
          /parece estar bloqueada/i
        );
        expect(mapSigningError(new Error('Wrong network'), i18n.t.bind(i18n)).message).toMatch(
          /red Stellar diferente/i
        );
      } finally {
        await i18n.changeLanguage(prevLng);
      }
    });

    it('detects wallet vs app network mismatch', () => {
      expect(isWalletNetworkMismatch('MAINNET', 'TESTNET')).toBe(true);
      expect(isWalletNetworkMismatch('TESTNET', 'PUBLIC')).toBe(true);
      expect(isWalletNetworkMismatch('MAINNET', 'PUBLIC')).toBe(false);
      expect(isWalletNetworkMismatch('TESTNET', 'TESTNET')).toBe(false);
      expect(isWalletNetworkMismatch('TESTNET', null)).toBe(false);
    });
  });
});
