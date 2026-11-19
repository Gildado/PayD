import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TransactionHistory from '../pages/TransactionHistory';
import * as transactionHistoryApi from '../services/transactionHistoryApi';
import { getTxExplorerUrl } from '../utils/stellarExpert';
import { useNetworkStore } from '../stores/networkStore';

vi.mock('../services/contracts', () => ({
  contractService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getContractId: vi.fn().mockReturnValue('CMOCK123'),
  },
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: null,
    connected: false,
    isPollingFallback: false,
  }),
}));

vi.mock('../components/ConnectionStatus', () => ({
  ConnectionStatus: () => null,
}));

vi.mock('@stellar/design-system', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children, addlClassName, ...props }: any) => (
    <div className={addlClassName} {...props}>
      {children}
    </div>
  ),
  Heading: ({ children }: any) => <h2>{children}</h2>,
  Text: ({ children }: any) => <p>{children}</p>,
  Input: ({ id, value, onChange, placeholder }: any) => (
    <input id={id} value={value} onChange={onChange} placeholder={placeholder} data-testid={id} />
  ),
  Select: ({ id, value, onChange, children }: any) => (
    <select id={id} value={value} onChange={onChange} data-testid={id}>
      {children}
    </select>
  ),
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Issue #1855: TransactionHistory Virtualization & Jump-to-Date', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('virtualized list renders items inside viewport container', async () => {
    const mockItems = Array.from({ length: 50 }, (_, i) => ({
      id: `tx-${i}`,
      kind: 'classic' as const,
      createdAt: '2026-11-19T10:00:00Z',
      status: 'confirmed',
      amount: `${100 + i}`,
      asset: 'USDC',
      actor: `GACCOUNT${i}`,
      txHash: `hash${i.toString().padStart(60, '0')}`,
      label: `Transaction ${i}`,
      badge: 'Classic',
    }));

    vi.spyOn(transactionHistoryApi, 'fetchHistoryPage').mockResolvedValue({
      items: mockItems,
      hasMore: false,
      total: 50,
    });

    renderWithProviders(<TransactionHistory />);

    await waitFor(() => {
      const feed = screen.getByRole('feed', { name: /transaction history list/i });
      expect(feed).toBeInTheDocument();
      expect(screen.getByText('Transaction 0')).toBeInTheDocument();
    });
  });

  test('jump-to-date control filters by date and calls API with date parameter', async () => {
    const fetchSpy = vi.spyOn(transactionHistoryApi, 'fetchHistoryPage').mockResolvedValue({
      items: [
        {
          id: 'jumped-1',
          kind: 'classic' as const,
          createdAt: '2026-10-01T12:00:00Z',
          status: 'confirmed',
          amount: '500',
          asset: 'USDC',
          actor: 'GACCOUNTTARGET',
          txHash: '1111'.padStart(64, '0'),
          label: 'Jumped Transaction',
          badge: 'Classic',
        },
      ],
      hasMore: false,
      total: 1,
    });

    renderWithProviders(<TransactionHistory />);

    const jumpInput = screen.getByLabelText('Jump to date');
    expect(jumpInput).toBeInTheDocument();

    fireEvent.change(jumpInput, { target: { value: '2026-10-01' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ startDate: '2026-10-01' }),
        }),
        expect.anything()
      );
    });
  });
});

describe('Issue #1856: Stellar Expert links & Copy hash action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('getTxExplorerUrl links to the correct network path segment', () => {
    const sampleHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    expect(getTxExplorerUrl(sampleHash, 'MAINNET')).toBe(
      `https://stellar.expert/explorer/public/tx/${sampleHash}`
    );
    expect(getTxExplorerUrl(sampleHash, 'TESTNET')).toBe(
      `https://stellar.expert/explorer/testnet/tx/${sampleHash}`
    );
  });

  test('renders Stellar Expert links according to current network', async () => {
    const sampleHash = 'aabbcc112233'.padStart(64, '0');
    useNetworkStore.getState().setNetwork('TESTNET');

    vi.spyOn(transactionHistoryApi, 'fetchHistoryPage').mockResolvedValue({
      items: [
        {
          id: 'testnet-tx',
          kind: 'classic' as const,
          createdAt: '2026-11-19T10:00:00Z',
          status: 'confirmed',
          amount: '250',
          asset: 'XLM',
          actor: 'GNETWORKTEST',
          txHash: sampleHash,
          label: 'Payment to Employee',
          badge: 'Classic',
        },
      ],
      hasMore: false,
      total: 1,
    });

    renderWithProviders(<TransactionHistory />);

    await waitFor(() => {
      const expertLink = screen.getByRole('link', { name: /view expert/i });
      expect(expertLink).toHaveAttribute(
        'href',
        `https://stellar.expert/explorer/testnet/tx/${sampleHash}`
      );
    });
  });

  test('copy hash button copies transaction hash and shows feedback', async () => {
    const sampleHash = 'deadbeef1234'.padStart(64, '0');
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    vi.spyOn(transactionHistoryApi, 'fetchHistoryPage').mockResolvedValue({
      items: [
        {
          id: 'copy-tx',
          kind: 'classic' as const,
          createdAt: '2026-11-19T10:00:00Z',
          status: 'confirmed',
          amount: '100',
          asset: 'USDC',
          actor: 'GCOPYTEST',
          txHash: sampleHash,
          label: 'Payment',
          badge: 'Classic',
        },
      ],
      hasMore: false,
      total: 1,
    });

    renderWithProviders(<TransactionHistory />);

    await waitFor(() => {
      const copyButton = screen.getByRole('button', {
        name: new RegExp(`copy transaction hash ${sampleHash}`, 'i'),
      });
      expect(copyButton).toBeInTheDocument();
      fireEvent.click(copyButton);
    });

    expect(writeTextMock).toHaveBeenCalledWith(sampleHash);
  });
});

