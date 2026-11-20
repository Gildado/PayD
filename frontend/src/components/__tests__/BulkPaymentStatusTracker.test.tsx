import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { BulkPaymentStatusTracker } from '../BulkPaymentStatusTracker';
import type { PayrollRunRecord, PayrollRunSummary } from '../../services/bulkPaymentStatus';
import '../../i18n';

const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();
const mockNotifyPaymentSuccess = vi.fn();
const mockNotifyApiError = vi.fn();

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    notify: vi.fn(),
    notifySuccess: mockNotifySuccess,
    notifyError: mockNotifyError,
    notifyPaymentSuccess: mockNotifyPaymentSuccess,
    notifyPaymentFailure: vi.fn(),
    notifyWalletEvent: vi.fn(),
    notifyApiError: mockNotifyApiError,
  }),
}));

vi.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    address: null,
    requireWallet: vi.fn().mockResolvedValue(null),
    signTransaction: vi.fn(),
  }),
}));

vi.mock('../../hooks/useWalletSigning', () => ({
  useWalletSigning: () => ({ sign: vi.fn() }),
}));

vi.mock('../../services/contracts', () => ({
  contractService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getContractId: vi.fn().mockReturnValue('CMOCK'),
  },
}));

const mockFetchPayrollRuns = vi.fn();
const mockFetchPayrollRunSummary = vi.fn();
const mockFetchPayrollRunOnChainState = vi.fn();
const mockRetryFailedPayment = vi.fn();

vi.mock('../../services/bulkPaymentStatus', () => ({
  fetchPayrollRuns: (...args: unknown[]) => mockFetchPayrollRuns(...args),
  fetchPayrollRunSummary: (...args: unknown[]) => mockFetchPayrollRunSummary(...args),
  fetchPayrollRunOnChainState: (...args: unknown[]) => mockFetchPayrollRunOnChainState(...args),
  retryFailedPayment: (...args: unknown[]) => mockRetryFailedPayment(...args),
  getTxExplorerUrl: (txHash: string) => `https://stellar.expert/explorer/testnet/tx/${txHash}`,
}));

// A minimal fake matching the slice of the socket.io-client `Socket` API this
// component actually uses (on/off/emit), plus a `trigger` helper so tests can
// simulate the server pushing an event.
function createFakeSocket() {
  const listeners: Record<string, Array<(payload: unknown) => void>> = {};
  return {
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      (listeners[event] ||= []).push(cb);
    }),
    off: vi.fn((event: string, cb: (payload: unknown) => void) => {
      listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
    }),
    emit: vi.fn(),
    trigger(event: string, payload: unknown) {
      (listeners[event] || []).forEach((cb) => cb(payload));
    },
  };
}

let socketState: {
  socket: ReturnType<typeof createFakeSocket> | null;
  connected: boolean;
  isPollingFallback: boolean;
  isReconnecting: boolean;
};

vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => socketState,
}));

const baseRun: PayrollRunRecord = {
  id: 1,
  batch_id: 'batch-1',
  status: 'processing',
  total_amount: '1000',
  asset_code: 'USDC',
  created_at: '2024-01-01T00:00:00Z',
};

describe('BulkPaymentStatusTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketState = {
      socket: createFakeSocket(),
      connected: true,
      isPollingFallback: false,
      isReconnecting: false,
    };
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun], total: 1 });
  });

  test('subscribes to the bulk channel for each loaded run and unsubscribes on unmount', async () => {
    const { unmount } = render(<BulkPaymentStatusTracker organizationId={1} />);

    await screen.findByText('batch-1');

    await waitFor(() => {
      expect(socketState.socket!.emit).toHaveBeenCalledWith('subscribe:bulk', {
        batchId: 'batch-1',
      });
    });

    unmount();

    expect(socketState.socket!.emit).toHaveBeenCalledWith('unsubscribe:bulk', {
      batchId: 'batch-1',
    });
  });

  test('updates the progress bar and confirmed/pending counts from a live bulk:confirmation event', async () => {
    render(<BulkPaymentStatusTracker organizationId={1} />);
    await screen.findByText('batch-1');

    act(() => {
      socketState.socket!.trigger('bulk:confirmation', {
        batchId: 'batch-1',
        status: 'processing',
        progress: 40,
        completedCount: 4,
        totalItems: 10,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('40%')).toBeInTheDocument();
    });
    expect(screen.getByText('4 confirmed · 6 pending')).toBeInTheDocument();
  });

  test('reflects the live socket status without needing a manual refresh', async () => {
    render(<BulkPaymentStatusTracker organizationId={1} />);
    await screen.findByText('batch-1');
    expect(screen.getByText('processing')).toBeInTheDocument();

    act(() => {
      socketState.socket!.trigger('bulk:confirmation', {
        batchId: 'batch-1',
        status: 'completed',
        completedCount: 10,
        totalItems: 10,
        progress: 100,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  test('shows a completion toast once when the batch reaches 100%, even if the event repeats', async () => {
    render(<BulkPaymentStatusTracker organizationId={1} />);
    await screen.findByText('batch-1');

    const completedPayload = {
      batchId: 'batch-1',
      status: 'completed',
      completedCount: 10,
      totalItems: 10,
      progress: 100,
    };

    act(() => {
      socketState.socket!.trigger('bulk:confirmation', completedPayload);
    });

    await waitFor(() => {
      expect(mockNotifySuccess).toHaveBeenCalledTimes(1);
    });
    expect(mockNotifySuccess).toHaveBeenCalledWith(
      'Payroll batch complete',
      '10 payments confirmed for batch batch-1'
    );

    // Simulate the same event arriving again, e.g. after a rapid reconnect.
    act(() => {
      socketState.socket!.trigger('bulk:confirmation', completedPayload);
    });

    expect(mockNotifySuccess).toHaveBeenCalledTimes(1);
  });

  test('shows the Live connection indicator when the socket is connected', async () => {
    render(<BulkPaymentStatusTracker organizationId={1} />);
    await screen.findByText('batch-1');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  test('shows the Reconnecting connection indicator while retrying a dropped connection', async () => {
    socketState = {
      socket: createFakeSocket(),
      connected: false,
      isPollingFallback: false,
      isReconnecting: true,
    };
    render(<BulkPaymentStatusTracker organizationId={1} />);
    await screen.findByText('batch-1');
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });

  test('shows the Polling connection indicator once reconnection attempts are exhausted', async () => {
    socketState = {
      socket: null,
      connected: false,
      isPollingFallback: true,
      isReconnecting: false,
    };
    render(<BulkPaymentStatusTracker organizationId={1} />);
    await screen.findByText('batch-1');
    expect(screen.getByText('Polling')).toBeInTheDocument();
  });

  test('flashes an individual recipient row when its status changes after a socket update', async () => {
    const pendingSummary: PayrollRunSummary = {
      payroll_run: baseRun,
      items: [
        {
          id: 1,
          employee_id: 1,
          employee_first_name: 'Ada',
          employee_last_name: 'Lovelace',
          amount: '100',
          status: 'pending',
        },
      ],
      summary: { total_employees: 1, total_amount: '100' },
    };
    const confirmedSummary: PayrollRunSummary = {
      ...pendingSummary,
      items: [{ ...pendingSummary.items[0], status: 'completed' }],
    };

    mockFetchPayrollRunSummary
      .mockResolvedValueOnce(pendingSummary)
      .mockResolvedValueOnce(confirmedSummary);

    render(<BulkPaymentStatusTracker organizationId={1} />);
    await screen.findByText('batch-1');

    fireEvent.click(screen.getByRole('button', { name: /details/i }));

    await screen.findByText('Ada Lovelace');
    expect(screen.getByText('pending')).toBeInTheDocument();

    act(() => {
      socketState.socket!.trigger('bulk:confirmation', {
        batchId: 'batch-1',
        status: 'processing',
        completedCount: 1,
        totalItems: 1,
        progress: 100,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('confirmed')).toBeInTheDocument();
    });
    expect(screen.getByText('confirmed').className).toContain('status-flash');
  });
});
