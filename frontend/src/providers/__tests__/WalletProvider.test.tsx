import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletProvider } from '../WalletProvider';
import { useWallet } from '../../hooks/useWallet';

const mockNotifyWalletEvent = vi.fn();
const mockGetSupportedWallets = vi.fn();
const mockGetAddress = vi.fn();
const mockSetWallet = vi.fn();
const mockDisconnect = vi.fn();
const mockSignTransaction = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'wallet.modalTitle') return 'Connect to PayD';
      return key;
    },
  }),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notifyWalletEvent: mockNotifyWalletEvent,
  }),
}));

vi.mock('@creit.tech/stellar-wallets-kit', () => ({
  StellarWalletsKit: class {
    setWallet = mockSetWallet;
    getAddress = mockGetAddress;
    getSupportedWallets = mockGetSupportedWallets;
    disconnect = mockDisconnect;
    signTransaction = mockSignTransaction;
  },
  WalletNetwork: {
    TESTNET: 'TESTNET',
    PUBLIC: 'PUBLIC',
  },
  FreighterModule: class {},
  xBullModule: class {},
  LobstrModule: class {},
  FREIGHTER_ID: 'freighter',
  LOBSTR_ID: 'lobstr',
}));

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function WalletHarness() {
  const { address, connect } = useWallet();

  return (
    <div>
      <button type="button" onClick={() => void connect()}>
        Open wallet modal
      </button>
      <div>{address ?? 'No wallet connected'}</div>
    </div>
  );
}

describe('WalletProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNotifyWalletEvent.mockReset();
    mockGetSupportedWallets.mockReset();
    mockGetAddress.mockReset();
    mockSetWallet.mockReset();
    mockDisconnect.mockReset();
    mockSignTransaction.mockReset();
    mockGetSupportedWallets.mockResolvedValue([
      {
        id: 'freighter',
        name: 'Freighter',
        icon: undefined,
        isAvailable: true,
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an inline error when wallet connection takes longer than 15 seconds', async () => {
    const hangingConnection = createDeferredPromise<{ address: string }>();
    mockGetAddress.mockReturnValue(hangingConnection.promise);

    render(
      <WalletProvider connectionTimeoutMs={5}>
        <WalletHarness />
      </WalletProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /open wallet modal/i }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Wallet connection timed out after 15 seconds. Confirm the request in your wallet and try again.'
      );
    });

    expect(screen.getByRole('dialog', { name: /connect to payd/i })).toBeInTheDocument();
    expect(mockNotifyWalletEvent).toHaveBeenCalledWith(
      'connection_failed',
      'Wallet connection timed out after 15 seconds. Confirm the request in your wallet and try again.'
    );
  });

  it('closes the modal and updates wallet state after a successful connection', async () => {
    mockGetAddress.mockResolvedValue({ address: 'GABCD1234567890TESTWALLET' });

    render(
      <WalletProvider connectionTimeoutMs={50}>
        <WalletHarness />
      </WalletProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /open wallet modal/i }));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: /freighter/i }));

    await waitFor(() => {
      expect(screen.getByText('GABCD1234567890TESTWALLET')).toBeInTheDocument();
    });

    expect(screen.queryByRole('dialog', { name: /connect to payd/i })).not.toBeInTheDocument();
    expect(mockNotifyWalletEvent).toHaveBeenCalledWith('connected', 'GABCD1...LLET via freighter');
  });

  it('finishes initialization when silent reconnect hangs', async () => {
    localStorage.setItem('payd:last_wallet_name', 'freighter');
    const hangingReconnect = createDeferredPromise<{ address: string }>();
    mockGetAddress.mockReturnValue(hangingReconnect.promise);

    render(
      <WalletProvider connectionTimeoutMs={5}>
        <div>Wallet-ready app</div>
      </WalletProvider>
    );

    expect(screen.getByText(/restoring wallet session/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Wallet-ready app')).toBeInTheDocument();
    });
    expect(screen.queryByText(/restoring wallet session/i)).not.toBeInTheDocument();
  });
});
