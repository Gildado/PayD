import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNotification } from './useNotification';
import { useSocket } from './useSocket';
import { useWallet } from './useWallet';
import { useWalletSigning } from './useWalletSigning';
import { contractService } from '../services/contracts';
import {
  fetchPayrollRunOnChainState,
  fetchPayrollRuns,
  fetchPayrollRunSummary,
  retryFailedPayment,
  type PayrollRecipientStatus,
  type PayrollRunRecord,
  type PayrollRunSummary,
} from '../services/bulkPaymentStatus';
import {
  buildRunRows,
  getRetryKey,
  normalizeBulkUpdatePayload,
  type BulkSocketUpdateMap,
  type BulkStatusFilter,
  type OnChainStateMap,
} from '../utils/bulkPaymentStatus';

const STATUS_FLASH_DURATION_MS = 1200;
const OPTIMISTIC_ROLLBACK_MS = 5_000;

export interface UseBulkPaymentStatusResult {
  runs: PayrollRunRecord[];
  rows: ReturnType<typeof buildRunRows>;
  summaries: Record<number, PayrollRunSummary>;
  onChainStates: OnChainStateMap;
  socketUpdates: BulkSocketUpdateMap;
  expandedRunId: number | null;
  isLoading: boolean;
  isRetryingKey: string | null;
  error: string | null;
  statusFilter: BulkStatusFilter;
  setStatusFilter: Dispatch<SetStateAction<BulkStatusFilter>>;
  recentlyUpdatedItemIds: Set<number>;
  recentlyUpdatedRunIds: Set<number>;
  optimisticUpdates: Record<string, PayrollRecipientStatus['status']>;
  refresh: () => void;
  toggleExpand: (runId: number) => Promise<void>;
  retry: (run: PayrollRunRecord, paymentIndex: number) => Promise<void>;
}

/**
 * Headless controller for the bulk-payment status tracker. Owns every piece of
 * state, ref, effect and callback the view needs; it never touches the DOM so
 * it can be exercised with `renderHook` in isolation.
 */
export function useBulkPaymentStatus(organizationId: number): UseBulkPaymentStatusResult {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [summaries, setSummaries] = useState<Record<number, PayrollRunSummary>>({});
  const [onChainStates, setOnChainStates] = useState<OnChainStateMap>({});
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [socketUpdates, setSocketUpdates] = useState<BulkSocketUpdateMap>({});
  const [recentlyUpdatedItemIds, setRecentlyUpdatedItemIds] = useState<Set<number>>(
    () => new Set()
  );
  const [recentlyUpdatedRunIds, setRecentlyUpdatedRunIds] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isRetryingKey, setIsRetryingKey] = useState<string | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, PayrollRecipientStatus['status']>
  >({});
  const optimisticTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BulkStatusFilter>('All');

  const { notifyError, notifyPaymentSuccess, notifySuccess, notifyApiError } = useNotification();
  const { socket } = useSocket();
  const { address, requireWallet } = useWallet();
  const { sign } = useWalletSigning();

  // Refs used by the socket handler so it can read the latest values without
  // re-subscribing to the socket on every render.
  const summariesRef = useRef(summaries);
  useEffect(() => {
    summariesRef.current = summaries;
  }, [summaries]);

  const lastKnownCountRef = useRef<Record<string, number>>({});
  const lastKnownStatusRef = useRef<Record<string, string>>({});
  const notifiedCompleteRef = useRef<Set<string>>(new Set());
  const itemFlashTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const runFlashTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const itemTimeouts = itemFlashTimeoutsRef.current;
    const runTimeouts = runFlashTimeoutsRef.current;
    const optimisticTimeouts = optimisticTimeoutsRef.current;
    return () => {
      itemTimeouts.forEach((timeout) => clearTimeout(timeout));
      itemTimeouts.clear();
      runTimeouts.forEach((timeout) => clearTimeout(timeout));
      runTimeouts.clear();
      optimisticTimeouts.forEach((timeout) => clearTimeout(timeout));
      optimisticTimeouts.clear();
    };
  }, []);

  const flashItem = useCallback((itemId: number) => {
    setRecentlyUpdatedItemIds((prev) => new Set(prev).add(itemId));
    const existingTimeout = itemFlashTimeoutsRef.current.get(itemId);
    if (existingTimeout) clearTimeout(existingTimeout);
    const timeout = setTimeout(() => {
      setRecentlyUpdatedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      itemFlashTimeoutsRef.current.delete(itemId);
    }, STATUS_FLASH_DURATION_MS);
    itemFlashTimeoutsRef.current.set(itemId, timeout);
  }, []);

  const flashRun = useCallback((runId: number) => {
    setRecentlyUpdatedRunIds((prev) => new Set(prev).add(runId));
    const existingTimeout = runFlashTimeoutsRef.current.get(runId);
    if (existingTimeout) clearTimeout(existingTimeout);
    const timeout = setTimeout(() => {
      setRecentlyUpdatedRunIds((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
      runFlashTimeoutsRef.current.delete(runId);
    }, STATUS_FLASH_DURATION_MS);
    runFlashTimeoutsRef.current.set(runId, timeout);
  }, []);

  // Re-fetches a run's recipient-level statuses after a socket update so
  // individual payment rows can animate their pending -> confirmed/failed
  // transition. The aggregate progress bar already updates from the socket
  // payload alone; this is only needed for the expanded per-recipient view.
  const refreshSummaryForAnimation = useCallback(
    async (runId: number) => {
      const previousItems = summariesRef.current[runId]?.items;
      try {
        const refreshed = await fetchPayrollRunSummary(runId);
        setSummaries((prev) => ({ ...prev, [runId]: refreshed }));

        if (previousItems) {
          const previousStatusById = new Map(previousItems.map((item) => [item.id, item.status]));
          refreshed.items.forEach((item) => {
            const prevStatus = previousStatusById.get(item.id);
            if (prevStatus && prevStatus !== item.status) {
              flashItem(item.id);
            }
          });
        }
      } catch {
        // Best-effort refresh; the aggregate progress bar still reflects the socket update.
      }
    },
    [flashItem]
  );

  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchPayrollRuns(organizationId, 1, 20);
      setRuns(payload.data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : t('bulkPaymentTracker.failedToLoadRuns');
      setError(message);
      notifyApiError(t('bulkPaymentTracker.bulkPaymentLoadFailed'), message);
    } finally {
      setIsLoading(false);
    }
  }, [notifyApiError, organizationId, t]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const loadOnChainState = useCallback(
    async (run: PayrollRunRecord, summary?: PayrollRunSummary) => {
      if (onChainStates[run.id]) return;

      const readSource =
        address || (import.meta.env.VITE_SOROBAN_READ_SOURCE as string | undefined) || null;
      if (!readSource) return;

      try {
        await contractService.initialize();
        const contractId =
          contractService.getContractId('bulk_payment', 'testnet') ||
          (import.meta.env.VITE_BULK_PAYMENT_CONTRACT_ID as string | undefined);

        if (!contractId) {
          throw new Error(t('bulkPaymentTracker.contractIdUnavailable'));
        }

        const onChainState = await fetchPayrollRunOnChainState({
          contractId,
          batchId: run.batch_id,
          recipientCount: summary?.items.length ?? 0,
          sourceAddress: readSource,
        });

        setOnChainStates((prev) => ({ ...prev, [run.id]: onChainState }));
      } catch (onChainError) {
        const message =
          onChainError instanceof Error
            ? onChainError.message
            : t('bulkPaymentTracker.unableToLoadOnChainState');
        notifyApiError(t('bulkPaymentTracker.bulkOnChainReadFailed'), message);
      }
    },
    [address, notifyApiError, onChainStates, t]
  );

  useEffect(() => {
    if (!socket) return;

    const onBulkUpdate = (payload: unknown) => {
      const normalized = normalizeBulkUpdatePayload(payload);
      if (!normalized) return;
      const { batchId } = normalized;

      // De-dupe: only treat this as new progress if the confirmed count
      // actually moved. A rapid reconnect can cause the same event to be
      // observed twice (e.g. a late 'connect' racing a queued handler); this
      // guard keeps that from re-triggering refetches/animations/toasts.
      const previousCount = lastKnownCountRef.current[batchId];
      const countChanged =
        normalized.completedCount !== null && normalized.completedCount !== previousCount;
      if (normalized.completedCount !== null) {
        lastKnownCountRef.current[batchId] = normalized.completedCount;
      }

      setSocketUpdates((prev) => {
        const existing = prev[batchId];
        // Ignore out-of-order updates that would move the count backwards.
        if (
          existing?.completedCount != null &&
          normalized.completedCount != null &&
          normalized.completedCount < existing.completedCount
        ) {
          return prev;
        }
        return { ...prev, [batchId]: normalized };
      });

      const run = runs.find((entry) => entry.batch_id === batchId);
      if (normalized.status) {
        const previousStatus = lastKnownStatusRef.current[batchId] ?? run?.status ?? null;
        if (run && normalized.status !== previousStatus) {
          flashRun(run.id);
        }
        lastKnownStatusRef.current[batchId] = normalized.status;
      }

      if (normalized.status === 'completed' && !notifiedCompleteRef.current.has(batchId)) {
        notifiedCompleteRef.current.add(batchId);
        const total = normalized.totalItems ?? normalized.completedCount ?? 0;
        notifySuccess(
          t('bulkPaymentTracker.batchCompleteTitle'),
          t('bulkPaymentTracker.batchCompleteBody', { batchId, count: total })
        );
      }

      if (countChanged && run && summariesRef.current[run.id]) {
        void refreshSummaryForAnimation(run.id);
      }
    };

    socket.on('bulk:confirmation', onBulkUpdate);
    socket.on('bulk_payment:confirmation', onBulkUpdate);

    runs.forEach((run) => {
      socket.emit('subscribe:bulk', { batchId: run.batch_id });
    });

    return () => {
      socket.off('bulk:confirmation', onBulkUpdate);
      socket.off('bulk_payment:confirmation', onBulkUpdate);
      runs.forEach((run) => {
        socket.emit('unsubscribe:bulk', { batchId: run.batch_id });
      });
    };
  }, [runs, socket, notifySuccess, t, flashRun, refreshSummaryForAnimation]);

  const toggleExpand = async (runId: number) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    const run = runs.find((entry) => entry.id === runId);
    if (!run) return;
    const summary =
      summaries[runId] ||
      (await fetchPayrollRunSummary(runId).then((payload) => {
        setSummaries((prev) => ({ ...prev, [runId]: payload }));
        return payload;
      }));
    await loadOnChainState(run, summary);
  };

  const retry = async (run: PayrollRunRecord, paymentIndex: number) => {
    const walletAddress = await requireWallet();
    if (!walletAddress) {
      return;
    }

    const retryKey = getRetryKey(run.batch_id, paymentIndex);
    const optimisticKey = `${run.id}:${paymentIndex}:optimistic`;

    setOptimisticUpdates((prev) => ({ ...prev, [optimisticKey]: 'pending' }));
    flashItem(summaries[run.id]?.items[paymentIndex]?.id ?? paymentIndex);

    const rollbackTimeout = setTimeout(() => {
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        delete next[optimisticKey];
        return next;
      });
      optimisticTimeoutsRef.current.delete(optimisticKey);
    }, OPTIMISTIC_ROLLBACK_MS);
    optimisticTimeoutsRef.current.set(optimisticKey, rollbackTimeout);

    setIsRetryingKey(retryKey);
    try {
      await contractService.initialize();
      const contractId =
        contractService.getContractId('bulk_payment', 'testnet') ||
        (import.meta.env.VITE_BULK_PAYMENT_CONTRACT_ID as string | undefined);

      if (!contractId) {
        throw new Error(t('bulkPaymentTracker.contractIdUnavailable'));
      }

      const { txHash } = await retryFailedPayment({
        contractId,
        batchId: run.batch_id,
        paymentIndex,
        sourceAddress: walletAddress,
        signTransaction: sign,
      });

      notifyPaymentSuccess(txHash, t('bulkPaymentTracker.retrySubmitted'));

      const existingTimeout = optimisticTimeoutsRef.current.get(optimisticKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        optimisticTimeoutsRef.current.delete(optimisticKey);
      }

      const refreshedSummary = await fetchPayrollRunSummary(run.id);
      setSummaries((prev) => ({ ...prev, [run.id]: refreshedSummary }));
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        delete next[optimisticKey];
        return next;
      });
      await loadOnChainState(run, refreshedSummary);
    } catch (retryError) {
      const existingTimeout = optimisticTimeoutsRef.current.get(optimisticKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        optimisticTimeoutsRef.current.delete(optimisticKey);
      }
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        delete next[optimisticKey];
        return next;
      });

      const message =
        retryError instanceof Error ? retryError.message : t('bulkPaymentTracker.retryFailed');
      notifyError(t('bulkPaymentTracker.retryFailed'), message);
    } finally {
      setIsRetryingKey(null);
    }
  };

  const rows = useMemo(
    () =>
      buildRunRows({
        runs,
        summaries,
        onChainStates,
        socketUpdates,
        statusFilter,
      }),
    [onChainStates, runs, socketUpdates, summaries, statusFilter]
  );

  return {
    runs,
    rows,
    summaries,
    onChainStates,
    socketUpdates,
    expandedRunId,
    isLoading,
    isRetryingKey,
    error,
    statusFilter,
    setStatusFilter,
    recentlyUpdatedItemIds,
    recentlyUpdatedRunIds,
    optimisticUpdates,
    refresh: () => {
      void loadRuns();
    },
    toggleExpand,
    retry,
  };
}
