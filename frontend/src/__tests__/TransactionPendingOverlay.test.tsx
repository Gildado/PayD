/**
 * Unit Tests for TransactionPendingOverlay Component
 *
 * The component expects a `transactions` array (each with id, type, status, timestamp,
 * optional hash & description) and an optional `onDismiss` callback.
 * It relies on `useWallet` from the wallet hook to get the network for explorer URLs.
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionPendingOverlay } from '../components/TransactionPendingOverlay';
import type { PendingTransaction } from '../components/TransactionPendingOverlay';

// Mock useWallet so the component doesn't throw about missing WalletProvider
vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({
    network: 'testnet',
    address: null,
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock stellarExpert util so explorer URL is predictable
vi.mock('../utils/stellarExpert', () => ({
  getTxExplorerUrl: (hash: string, network: string) =>
    `https://stellar.expert/explorer/${network}/tx/${hash}`,
}));

const baseTx: PendingTransaction = {
  id: 'tx-1',
  type: 'payment',
  status: 'pending',
  timestamp: Date.now(),
  description: 'Test payment transaction',
};

describe('TransactionPendingOverlay', () => {
  test('renders nothing when transactions array is empty', () => {
    const { container } = render(<TransactionPendingOverlay transactions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('displays pending transaction notification', () => {
    render(<TransactionPendingOverlay transactions={[baseTx]} />);

    expect(screen.getByText('Transaction pending')).toBeInTheDocument();
  });

  test('displays transaction description', () => {
    render(<TransactionPendingOverlay transactions={[baseTx]} />);

    expect(screen.getByText('Test payment transaction')).toBeInTheDocument();
  });

  test('displays confirmed transaction', () => {
    const confirmedTx: PendingTransaction = {
      ...baseTx,
      status: 'confirmed',
    };
    render(<TransactionPendingOverlay transactions={[confirmedTx]} />);

    expect(screen.getByText('Transaction confirmed')).toBeInTheDocument();
  });

  test('displays failed transaction', () => {
    const failedTx: PendingTransaction = {
      ...baseTx,
      status: 'failed',
    };
    render(<TransactionPendingOverlay transactions={[failedTx]} />);

    expect(screen.getByText('Transaction failed')).toBeInTheDocument();
  });

  test('shows explorer link when transaction has a hash', () => {
    const txWithHash: PendingTransaction = {
      ...baseTx,
      status: 'confirmed',
      hash: 'abc123def456',
    };
    render(<TransactionPendingOverlay transactions={[txWithHash]} />);

    const explorerLink = screen.getByText('View on explorer');
    expect(explorerLink.closest('a')).toHaveAttribute(
      'href',
      expect.stringContaining('abc123def456')
    );
  });

  test('shows dismiss button for confirmed transactions', () => {
    const onDismiss = vi.fn();
    const confirmedTx: PendingTransaction = {
      ...baseTx,
      status: 'confirmed',
    };
    render(<TransactionPendingOverlay transactions={[confirmedTx]} onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText(/Dismiss notification/i);
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    // onDismiss is called after a setTimeout(300)
    waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith(baseTx.id);
    });
  });

  test('shows dismiss button for failed transactions', () => {
    const onDismiss = vi.fn();
    const failedTx: PendingTransaction = {
      ...baseTx,
      status: 'failed',
    };
    render(<TransactionPendingOverlay transactions={[failedTx]} onDismiss={onDismiss} />);

    const dismissButton = screen.getByLabelText(/Dismiss notification/i);
    expect(dismissButton).toBeInTheDocument();
  });

  test('does not show dismiss button for pending transactions', () => {
    render(<TransactionPendingOverlay transactions={[baseTx]} />);

    expect(screen.queryByLabelText(/Dismiss notification/i)).not.toBeInTheDocument();
  });

  test('has proper accessibility attributes', () => {
    render(<TransactionPendingOverlay transactions={[baseTx]} />);

    const region = screen.getByRole('region');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-label', 'Transaction notifications');
  });

  test('shows transaction type badge', () => {
    render(<TransactionPendingOverlay transactions={[baseTx]} />);

    expect(screen.getByText('payment')).toBeInTheDocument();
  });
});
