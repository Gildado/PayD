import { describe, it, expect } from 'vitest';
import { getTxExplorerUrl } from '../stellarExpert';

describe('stellarExpert utils', () => {
  const mockTxHash = 'a'.repeat(64);

  it('builds a testnet URL by default when no network is provided', () => {
    const url = getTxExplorerUrl(mockTxHash);
    expect(url).toContain('stellar.expert/explorer/testnet/tx/');
    expect(url).toContain(mockTxHash);
  });

  it('builds a public URL when "public" network is provided', () => {
    const url = getTxExplorerUrl(mockTxHash, 'public');
    expect(url).toContain('stellar.expert/explorer/public/tx/');
  });

  it('builds a public URL when "MAINNET" network is provided (case-insensitive)', () => {
    const url = getTxExplorerUrl(mockTxHash, 'MAINNET');
    expect(url).toContain('stellar.expert/explorer/public/tx/');
  });

  it('builds a testnet URL when "TESTNET" network is provided', () => {
    const url = getTxExplorerUrl(mockTxHash, 'TESTNET');
    expect(url).toContain('stellar.expert/explorer/testnet/tx/');
  });
});
