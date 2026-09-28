import { describe, expect, test } from 'vitest';
import { getHorizonUrlForNetwork } from '../services/multisigDetection';

describe('getHorizonUrlForNetwork', () => {
  test('returns testnet Horizon when env override is absent', () => {
    const url = getHorizonUrlForNetwork('TESTNET');
    if (import.meta.env.PUBLIC_STELLAR_HORIZON_URL) {
      expect(url).toBe(String(import.meta.env.PUBLIC_STELLAR_HORIZON_URL).replace(/\/+$/, ''));
    } else {
      expect(url).toBe('https://horizon-testnet.stellar.org');
    }
  });

  test('returns public Horizon when env override is absent', () => {
    const url = getHorizonUrlForNetwork('PUBLIC');
    if (import.meta.env.PUBLIC_STELLAR_HORIZON_URL) {
      expect(url).toBe(String(import.meta.env.PUBLIC_STELLAR_HORIZON_URL).replace(/\/+$/, ''));
    } else {
      expect(url).toBe('https://horizon.stellar.org');
    }
  });
});
