import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionPendingOverlay, type PendingTransaction } from '../TransactionPendingOverlay';

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    network: 'PUBLIC' as const,
  }),
}));

describe('TransactionPendingOverlay', () => {
  const confirmedTransaction: PendingTransaction = {
    id: 'tx-1',
    type: 'Payroll',
    status: 'confirmed',
    hash: 'abc123',
    timestamp: new Date(2026, 3, 24, 9, 30, 0).getTime(),
    description: 'Payroll batch completed successfully.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the active wallet network when building explorer links', () => {
    render(<TransactionPendingOverlay transactions={[confirmedTransaction]} />);

    expect(
      screen.getByRole('link', { name: /view transaction tx-1 on stellar expert/i })
    ).toHaveAttribute('href', 'https://stellar.expert/explorer/public/tx/abc123');
  });

  it('waits for the exit animation before invoking onDismiss', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <TransactionPendingOverlay transactions={[confirmedTransaction]} onDismiss={onDismiss} />
    );

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification for payroll/i }));

    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onDismiss).toHaveBeenCalledWith('tx-1');
  });

  it('keeps pending notifications non-dismissible while work is in progress', () => {
    render(
      <TransactionPendingOverlay
        transactions={[
          {
            ...confirmedTransaction,
            id: 'tx-2',
            status: 'pending',
            hash: undefined,
          },
        ]}
      />
    );

    expect(screen.queryByRole('button', { name: /dismiss notification/i })).not.toBeInTheDocument();
    expect(screen.getByText(/transaction pending/i)).toBeInTheDocument();
  });
});
