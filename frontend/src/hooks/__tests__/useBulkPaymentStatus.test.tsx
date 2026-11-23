import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useBulkPaymentStatus } from '../useBulkPaymentStatus';
import type { PayrollRunRecord, PayrollRunSummary } from '../../services/bulkPaymentStatus';

const mockNotifyError = vi.fn();
const mockNotifySuccess = vi.fn();
const mockNotifyPaymentSuccess = vi.fn();
const mockNotifyApiError = vi.fn();

vi.mock('../useNotification', () => ({
  useNotification: () => ({
    notify: vi.fn(),
    notifySuccess: mockNotifySuccess,
    notifyError: mockNotifyError,
    notifyPaymentSuccess: mockNotifyPaymentSuccess,
    notifyApiError: mockNotifyApiError,
  }),
}));

vi.mock('../useWallet', () => ({
  useWallet: () => ({
    address: null,
    requireWallet: vi.fn().mockResolvedValue(null),
    signTransaction: vi.fn(),
  }),
}));

vi.mock('../useWalletSigning', () => ({
  useWalletSigning: () => ({ sign: vi.fn() }),
}));

vi.mock('../../services/contracts', () => ({
  contractService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getContractId: vi.fn().mockReturnValue('CMOCK'),
  },
}));

// A stable translator keeps `loadRuns`' identity fixed across renders, so the
// mount effect runs exactly once per hook instance.
const { stableT } = vi.hoisted(() => ({ stableT: (key: string) => key }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
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
  getTxExplorerUrl: (txHash: string) => `https://example.test/tx/${txHash}`,
}));

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

let socketState: { socket: ReturnType<typeof createFakeSocket> | null };

vi.mock('../useSocket', () => ({
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

const baseSummary: PayrollRunSummary = {
  payroll_run: baseRun,
  items: [
    {
      id: 11,
      employee_id: 42,
      employee_first_name: 'Ada',
      employee_last_name: 'Lovelace',
      amount: '100',
      status: 'pending',
    },
  ],
  summary: { total_employees: 1, total_amount: '100' },
};

describe('useBulkPaymentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketState = { socket: createFakeSocket() };
    mockFetchPayrollRuns.mockResolvedValue({ data: [baseRun], total: 1 });
    mockFetchPayrollRunSummary.mockResolvedValue(baseSummary);
    mockFetchPayrollRunOnChainState.mockResolvedValue({
      batchId: 1,
      status: null,
      successCount: 0,
      failCount: 0,
      totalSent: null,
      items: [],
    });
    mockRetryFailedPayment.mockResolvedValue({ txHash: 'submitted-hash' });
  });

  test('loads runs on mount and derives the view rows', async () => {
    const { result } = renderHook(() => useBulkPaymentStatus(1));

    await waitFor(() => expect(result.current.runs).toHaveLength(1));
    expect(mockFetchPayrollRuns).toHaveBeenCalledWith(1, 1, 20);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].run.batch_id).toBe('batch-1');
    expect(result.current.rows[0].liveStatus).toBe('processing');
  });

  test('applies a socket confirmation to the socket updates and derived rows', async () => {
    const { result } = renderHook(() => useBulkPaymentStatus(1));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    act(() => {
      socketState.socket!.trigger('bulk:confirmation', {
        batchId: 'batch-1',
        status: 'completed',
        progress: 100,
        completedCount: 10,
        totalItems: 10,
      });
    });

    await waitFor(() => expect(result.current.socketUpdates['batch-1'].completedCount).toBe(10));
    expect(result.current.rows[0].liveStatus).toBe('completed');
    expect(result.current.rows[0].progressPercent).toBe(100);
    expect(result.current.rows[0].pendingCount).toBe(0);
  });

  test('filters derived rows by live status', async () => {
    const { result } = renderHook(() => useBulkPaymentStatus(1));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    act(() => {
      socketState.socket!.trigger('bulk_payment:confirmation', {
        batchId: 'batch-1',
        status: 'completed',
        completedCount: 1,
        totalItems: 1,
      });
    });
    await waitFor(() => expect(result.current.rows[0].liveStatus).toBe('completed'));

    act(() => result.current.setStatusFilter('Completed'));
    expect(result.current.statusFilter).toBe('Completed');
    expect(result.current.rows).toHaveLength(1);

    act(() => result.current.setStatusFilter('Failed'));
    expect(result.current.rows).toHaveLength(0);
  });

  test('expands a run and loads its recipient summary', async () => {
    const { result } = renderHook(() => useBulkPaymentStatus(1));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    await act(async () => {
      await result.current.toggleExpand(1);
    });

    expect(result.current.expandedRunId).toBe(1);
    expect(mockFetchPayrollRunSummary).toHaveBeenCalledWith(1);
    await waitFor(() => expect(result.current.summaries[1]).toEqual(baseSummary));
  });

  test('surfaces load failures through error state and a notification', async () => {
    mockFetchPayrollRuns.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useBulkPaymentStatus(1));

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.runs).toHaveLength(0);
    expect(mockNotifyApiError).toHaveBeenCalledWith(expect.any(String), 'boom');
  });

  test('notifies completion only once for repeated identical events', async () => {
    const { result } = renderHook(() => useBulkPaymentStatus(1));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    const payload = {
      batchId: 'batch-1',
      status: 'completed',
      progress: 100,
      completedCount: 10,
      totalItems: 10,
    };

    act(() => {
      socketState.socket!.trigger('bulk:confirmation', payload);
      socketState.socket!.trigger('bulk:confirmation', payload);
    });

    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledTimes(1));
    expect(result.current.rows[0].liveStatus).toBe('completed');
  });

  test('ignores out-of-order completion counts', async () => {
    const { result } = renderHook(() => useBulkPaymentStatus(1));
    await waitFor(() => expect(result.current.runs).toHaveLength(1));

    act(() => {
      socketState.socket!.trigger('bulk:confirmation', {
        batchId: 'batch-1',
        status: 'processing',
        progress: 80,
        completedCount: 8,
        totalItems: 10,
      });
      socketState.socket!.trigger('bulk:confirmation', {
        batchId: 'batch-1',
        status: 'processing',
        progress: 40,
        completedCount: 4,
        totalItems: 10,
      });
    });

    await waitFor(() => expect(result.current.socketUpdates['batch-1'].completedCount).toBe(8));
    expect(result.current.rows[0].confirmationCount).toBe(8);
  });
});
