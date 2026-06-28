import { describe, test, expect, vi, beforeEach } from 'vitest';

// We test the pure network-resolution logic by importing after mocking the env.
// Each test group re-imports the module to pick up the mocked env value.

const TX_HASH = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1';

describe('getTxExplorerUrl – with explicit network', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('MAINNET → public path segment', async () => {
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH, 'MAINNET')).toBe(
      `https://stellar.expert/explorer/public/tx/${TX_HASH}`
    );
  });

  test('mainnet (lowercase) → public path segment', async () => {
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH, 'mainnet')).toBe(
      `https://stellar.expert/explorer/public/tx/${TX_HASH}`
    );
  });

  test('PUBLIC → public path segment', async () => {
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH, 'PUBLIC')).toBe(
      `https://stellar.expert/explorer/public/tx/${TX_HASH}`
    );
  });

  test('public (lowercase) → public path segment', async () => {
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH, 'public')).toBe(
      `https://stellar.expert/explorer/public/tx/${TX_HASH}`
    );
  });

  test('TESTNET → testnet path segment', async () => {
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH, 'TESTNET')).toBe(
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`
    );
  });

  test('testnet (lowercase) → testnet path segment', async () => {
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH, 'testnet')).toBe(
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`
    );
  });

  test('unknown network → testnet path segment', async () => {
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH, 'LOCAL')).toBe(
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`
    );
  });
});

describe('getTxExplorerUrl – env-based fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('uses VITE_STELLAR_EXPLORER_TX_URL when no network provided', async () => {
    vi.stubEnv('VITE_STELLAR_EXPLORER_TX_URL', 'https://stellar.expert/explorer/public/tx/');
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    expect(getTxExplorerUrl(TX_HASH)).toBe(`https://stellar.expert/explorer/public/tx/${TX_HASH}`);
    vi.unstubAllEnvs();
  });

  test('defaults to testnet when env var is absent', async () => {
    vi.stubEnv('VITE_STELLAR_EXPLORER_TX_URL', '');
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    const url = getTxExplorerUrl(TX_HASH);
    expect(url).toContain('/testnet/tx/');
    expect(url.endsWith(TX_HASH)).toBe(true);
    vi.unstubAllEnvs();
  });

  test('appends trailing slash if base URL is missing it', async () => {
    vi.stubEnv('VITE_STELLAR_EXPLORER_TX_URL', 'https://stellar.expert/explorer/testnet/tx');
    const { getTxExplorerUrl } = await import('../utils/stellarExpert');
    const url = getTxExplorerUrl(TX_HASH);
    expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${TX_HASH}`);
    vi.unstubAllEnvs();
  });
});
