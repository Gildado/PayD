import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWalletManager } from '../../hooks/useWalletManager';

const mockSetWallet = vi.fn();
const mockGetAddress = vi.fn();
const mockGetSupportedWallets = vi.fn();
const mockDisconnect = vi.fn();
const mockSignTransaction = vi.fn();

vi.mock('@creit.tech/stellar-wallets-kit', () => {
  class MockStellarWalletsKit {
    setWallet = mockSetWallet;
    getAddress = mockGetAddress;
    getSupportedWallets = mockGetSupportedWallets;
    disconnect = mockDisconnect;
    signTransaction = mockSignTransaction;
  }

  return {
    StellarWalletsKit: MockStellarWalletsKit,
    WalletNetwork: { TESTNET: 'TESTNET', PUBLIC: 'PUBLIC' },
    FreighterModule: vi.fn(),
    xBullModule: vi.fn(),
    LobstrModule: vi.fn(),
    FREIGHTER_ID: 'freighter',
    LOBSTR_ID: 'lobstr',
  };
});

const mockNotifyWalletEventHook = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifyWalletEvent: mockNotifyWalletEventHook,
  }),
}));

describe('useWalletManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetSupportedWallets.mockResolvedValue([]);
  });

  it('initializes and attempts silent reconnect if wallet in localStorage', async () => {
    localStorage.setItem('payd:last_wallet_name', 'freighter');
    mockGetAddress.mockResolvedValue({ address: 'G123' });

    const { result } = renderHook(() => useWalletManager());

    // Initially connecting
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.isInitialized).toBe(false);

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.address).toBe('G123');
    expect(result.current.walletName).toBe('freighter');
    expect(result.current.isConnecting).toBe(false);
  });

  it('handles manual connect sequence appropriately', async () => {
    mockGetSupportedWallets.mockResolvedValue([
      { id: 'freighter', name: 'Freighter', isAvailable: true },
    ]);

    const { result } = renderHook(() => useWalletManager());
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.walletModalOpen).toBe(true);
    });
    expect(result.current.walletOptions.length).toBe(1);

    mockGetAddress.mockResolvedValue({ address: 'G456' });

    await act(async () => {
      await result.current.connectWithWallet('freighter');
    });

    await waitFor(() => {
      expect(result.current.walletModalOpen).toBe(false);
    });
    expect(result.current.address).toBe('G456');
    expect(result.current.walletName).toBe('freighter');
  });

  it('handles disconnect', () => {
    const { result } = renderHook(() => useWalletManager());

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(result.current.walletName).toBeNull();
    expect(localStorage.getItem('payd:last_wallet_name')).toBeNull();
  });
});
