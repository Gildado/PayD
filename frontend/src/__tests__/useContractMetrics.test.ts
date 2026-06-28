import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useContractMetrics } from '../hooks/useContractMetrics';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../services/contracts', () => ({
  contractService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getContractId: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: vi.fn(),
    Api: { isSimulationError: vi.fn().mockReturnValue(false) },
  },
  Contract: vi.fn(),
  TransactionBuilder: vi.fn(),
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
  BASE_FEE: '100',
  xdr: {},
  nativeToScVal: vi.fn(),
  scValToNative: vi.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useContractMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with loading metrics', () => {
    const { result } = renderHook(() => useContractMetrics('GABC1234567890', 'testnet'));

    const allMetricGroups = [
      result.current.metrics.bulk_payment,
      result.current.metrics.revenue_split,
      result.current.metrics.vesting_escrow,
      result.current.metrics.cross_asset_payment,
    ];
    for (const group of allMetricGroups) {
      for (const metric of Object.values(group)) {
        expect(metric.status).toBe('loading');
      }
    }
  });

  it('sets error when no sourceAccount provided', async () => {
    const { result } = renderHook(() => useContractMetrics(null, 'testnet'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('uses "warn" status for unconfigured contracts', async () => {
    const { result } = renderHook(() => useContractMetrics('GABC1234567890', 'testnet'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All contract IDs return null from the mock → warn
    expect(result.current.metrics.bulk_payment.batchCount.status).toBe('warn');
    expect(result.current.metrics.revenue_split.distributionCount.status).toBe('warn');
  });

  it('exposes a refresh function', () => {
    const { result } = renderHook(() => useContractMetrics('GABC1234567890', 'testnet'));
    expect(typeof result.current.refresh).toBe('function');
  });

  it('records lastRefreshed after fetch completes', async () => {
    const { result } = renderHook(() => useContractMetrics('GABC1234567890', 'testnet'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.metrics.lastRefreshed).toBeInstanceOf(Date);
  });
});
