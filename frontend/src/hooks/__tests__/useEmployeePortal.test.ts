import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useEmployeePortal } from '../useEmployeePortal';

vi.mock('../../services/currencyConversion', () => ({
  fetchExchangeRates: vi.fn().mockResolvedValue({
    USD: 1,
    NGN: 1600,
    EUR: 0.91,
  }),
  getStellarExpertLink: (txHash: string) => `https://stellar.expert/explorer/testnet/tx/${txHash}`,
}));

describe('useEmployeePortal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const flushPortalLoad = async () => {
    await act(async () => {
      vi.advanceTimersByTime(900);
      await Promise.resolve();
    });
  };

  it('loads transactions and computed balances', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    expect(result.current.isLoading).toBe(true);

    await flushPortalLoad();

    expect(result.current.isLoading).toBe(false);

    expect(result.current.transactions.length).toBeGreaterThan(0);
    expect(result.current.balance?.orgUsd.value).toBeGreaterThan(0);
    expect(result.current.balance?.exchangeRate).toBe(1600);
  });

  it('resets pagination when search query changes', async () => {
    const { result } = renderHook(() => useEmployeePortal());

    await flushPortalLoad();

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.setSearchQuery('Salary');
    });
    expect(result.current.currentPage).toBe(1);
  });
});
