import { useCallback, useEffect, useMemo, useState } from 'react';
import { List } from 'react-window';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { useWallet } from '../hooks/useWallet';
import { useWalletSigning } from '../hooks/useWalletSigning';
import { contractService } from '../services/contracts';
import { SkeletonLoader } from './SkeletonLoader';
import {
  fetchPayrollRunOnChainState,
  fetchPayrollRuns,
  fetchPayrollRunSummary,
  getTxExplorerUrl,
  retryFailedPayment,
  type OnChainBatchState,
  type PayrollRecipientStatus,
  type PayrollRunRecord,
  type PayrollRunSummary,
} from '../services/bulkPaymentStatus';

interface BulkPaymentStatusTrackerProps {
  organizationId: number;
}

type ConfirmationMap = Record<string, number>;
type OnChainStateMap = Record<number, OnChainBatchState>;

function toRecipientStatus(
  status: PayrollRecipientStatus['status']
): 'pending' | 'confirmed' | 'failed' {
  if (status === 'completed') return 'confirmed';
  if (status === 'failed') return 'failed';
  return 'pending';
}

function getEmployeeName(recipient: PayrollRecipientStatus): string {
  const fullName =
    `${recipient.employee_first_name ?? ''} ${recipient.employee_last_name ?? ''}`.trim();
  return fullName || recipient.employee_email || `Employee #${recipient.employee_id}`;
}

function findRunTxHash(summary?: PayrollRunSummary): string | null {
  if (!summary) return null;
  const txHash = summary.items.find((item) => Boolean(item.tx_hash))?.tx_hash;
  return txHash || null;
}

function normalizeConfirmationPayload(payload: unknown): {
  batchId: string | null;
  confirmations: number | null;
} {
  if (!payload || typeof payload !== 'object') {
    return { batchId: null, confirmations: null };
  }

  const record = payload as Record<string, unknown>;
  const batchId =
    (record.batchId as string | undefined) ||
    (record.batch_id as string | undefined) ||
    (record.runId as string | undefined) ||
    null;

  const countRaw =
    record.confirmations ?? record.confirmationCount ?? record.confirmed ?? record.count ?? null;

  const count =
    typeof countRaw === 'number'
      ? countRaw
      : typeof countRaw === 'string'
        ? Number.parseInt(countRaw, 10)
        : null;

  return {
    batchId,
    confirmations: Number.isFinite(count) ? count : null,
  };
}

export function BulkPaymentStatusTracker({ organizationId }: BulkPaymentStatusTrackerProps) {
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [summaries, setSummaries] = useState<Record<number, PayrollRunSummary>>({});
  const [onChainStates, setOnChainStates] = useState<OnChainStateMap>({});
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [confirmations, setConfirmations] = useState<ConfirmationMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRetryingKey, setIsRetryingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'Pending' | 'Failed'>(
    'All'
  );

  const { notifyError, notifyPaymentSuccess, notifyApiError } = useNotification();
  const { socket } = useSocket();
  const { address, requireWallet } = useWallet();
  const { sign } = useWalletSigning();

  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchPayrollRuns(organizationId, 1, 20);
      setRuns(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load bulk runs';
      setError(message);
      notifyApiError('Bulk payment load failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [notifyApiError, organizationId]);

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
          throw new Error('Bulk payment contract ID is unavailable.');
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
            : 'Unable to load on-chain batch state';
        notifyApiError('Bulk on-chain read failed', message);
      }
    },
    [address, notifyApiError, onChainStates]
  );

  useEffect(() => {
    if (!socket) return;

    const onBulkConfirmation = (payload: unknown) => {
      const normalized = normalizeConfirmationPayload(payload);
      if (!normalized.batchId || normalized.confirmations === null) return;
      setConfirmations((prev) => ({
        ...prev,
        [normalized.batchId as string]: normalized.confirmations as number,
      }));
    };

    socket.on('bulk:confirmation', onBulkConfirmation);
    socket.on('bulk_payment:confirmation', onBulkConfirmation);

    runs.forEach((run) => {
      socket.emit('subscribe:bulk', { batchId: run.batch_id });
    });

    return () => {
      socket.off('bulk:confirmation', onBulkConfirmation);
      socket.off('bulk_payment:confirmation', onBulkConfirmation);
      runs.forEach((run) => {
        socket.emit('unsubscribe:bulk', { batchId: run.batch_id });
      });
    };
  }, [runs, socket]);

  const handleToggleExpand = async (runId: number) => {
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

  const handleRetry = async (run: PayrollRunRecord, paymentIndex: number) => {
    const walletAddress = await requireWallet();
    if (!walletAddress) {
      return;
    }

    const retryKey = `${run.batch_id}:${paymentIndex}`;

    setIsRetryingKey(retryKey);
    try {
      await contractService.initialize();
      const contractId =
        contractService.getContractId('bulk_payment', 'testnet') ||
        (import.meta.env.VITE_BULK_PAYMENT_CONTRACT_ID as string | undefined);

      if (!contractId) {
        throw new Error('Bulk payment contract ID is unavailable.');
      }

      const { txHash } = await retryFailedPayment({
        contractId,
        batchId: run.batch_id,
        paymentIndex,
        sourceAddress: walletAddress,
        signTransaction: sign,
      });

      notifyPaymentSuccess(txHash, 'Retry submitted');
      const refreshedSummary = await fetchPayrollRunSummary(run.id);
      setSummaries((prev) => ({ ...prev, [run.id]: refreshedSummary }));
      await loadOnChainState(run, refreshedSummary);
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : 'Retry failed';
      notifyError('Retry failed', message);
    } finally {
      setIsRetryingKey(null);
    }
  };

  const rows = useMemo(() => {
    return runs
      .map((run) => {
        const summary = summaries[run.id];
        const onChainState = onChainStates[run.id];
        const employeeCount = summary?.summary.total_employees ?? summary?.items.length ?? 0;
        const txHash = findRunTxHash(summary);
        const confirmationCount = confirmations[run.batch_id] ?? onChainState?.successCount ?? 0;
        const hasFailedRecipients =
          summary?.items.some((item) => item.status === 'failed') ?? false;

        return {
          run,
          summary,
          onChainState,
          employeeCount,
          txHash,
          confirmationCount,
          hasFailedRecipients,
        };
      })
      .filter((row) => {
        if (statusFilter === 'All') return true;
        return row.run.status.toLowerCase() === statusFilter.toLowerCase();
      });
  }, [confirmations, onChainStates, runs, summaries, statusFilter]);

  return (
    <div className="card glass noise mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Bulk Payment Status Tracker</h3>
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'All' | 'Completed' | 'Pending' | 'Failed')
            }
            className="dropdown-select"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
          <button
            type="button"
            onClick={() => {
              void loadRuns();
            }}
            className="text-xs font-semibold text-accent hover:text-accent/80"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'Loading bulk payroll runs…' : ''}
      </span>

      {!isLoading && rows.length === 0 ? (
        <p className="text-sm text-muted">No payroll batch runs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted border-b border-hi">
              <tr>
                <th className="py-2 pr-4">Batch</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Progress</th>
                <th className="py-2 pr-4">Employees</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Confirmations</th>
                <th className="py-2 pr-4">Tx Hash</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody aria-busy={isLoading}>
              {isLoading && rows.length === 0 ? (
                <SkeletonLoader variant="table-row" count={5} columns={8} />
              ) : null}
              {rows.map(
                ({
                  run,
                  summary,
                  onChainState,
                  employeeCount,
                  txHash,
                  confirmationCount,
                  hasFailedRecipients,
                }) => (
                  <FragmentRow
                    key={run.id}
                    run={run}
                    summary={summary}
                    onChainState={onChainState}
                    employeeCount={employeeCount}
                    txHash={txHash}
                    confirmationCount={confirmationCount}
                    expanded={expandedRunId === run.id}
                    retryingKey={isRetryingKey}
                    hasFailedRecipients={hasFailedRecipients}
                    onToggleExpand={() => {
                      void handleToggleExpand(run.id);
                    }}
                    onRetry={(paymentIndex) => {
                      void handleRetry(run, paymentIndex);
                    }}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface FragmentRowProps {
  run: PayrollRunRecord;
  summary?: PayrollRunSummary;
  onChainState?: OnChainBatchState;
  employeeCount: number;
  txHash: string | null;
  confirmationCount: number;
  expanded: boolean;
  retryingKey: string | null;
  hasFailedRecipients: boolean;
  onToggleExpand: () => void;
  onRetry: (paymentIndex: number) => void;
}

function FragmentRow({
  run,
  summary,
  onChainState,
  employeeCount,
  txHash,
  confirmationCount,
  expanded,
  retryingKey,
  hasFailedRecipients,
  onToggleExpand,
  onRetry,
}: FragmentRowProps) {
  const progressPercent =
    employeeCount > 0 ? Math.round((confirmationCount / employeeCount) * 100) : 0;

  return (
    <>
      <tr className="border-b border-hi/40">
        <td className="py-3 pr-4 font-mono">{run.batch_id}</td>
        <td className="py-3 pr-4 capitalize">
          <div className="flex flex-col">
            <span>{run.status}</span>
            {onChainState?.status ? (
              <span className="text-[11px] uppercase tracking-wide text-muted">
                On-chain: {onChainState.status}
              </span>
            ) : null}
          </div>
        </td>
        <td className="py-3 pr-4">
          {run.status === 'processing' || run.status === 'pending' ? (
            <div className="flex flex-col gap-1 min-w-[100px]">
              <div className="w-full bg-surface-hi rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-muted">{progressPercent}%</span>
            </div>
          ) : (
            <span className="text-muted">-</span>
          )}
        </td>
        <td className="py-3 pr-4">{employeeCount}</td>
        <td className="py-3 pr-4">
          {run.total_amount} {run.asset_code}
        </td>
        <td className="py-3 pr-4">{confirmationCount}</td>
        <td className="py-3 pr-4">
          {txHash ? (
            <a
              href={getTxExplorerUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-accent"
            >
              {txHash.slice(0, 10)}...
            </a>
          ) : (
            <span className="text-muted">N/A</span>
          )}
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-accent hover:text-accent/80"
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
            {hasFailedRecipients ? (
              <span className="text-xs text-danger">Retry available below</span>
            ) : null}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-hi/40 bg-black/10">
          <td colSpan={8} className="py-3">
            {!summary ? (
              <p className="text-sm text-muted">Loading recipient statuses...</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 rounded-md border border-hi/30 px-3 py-2 text-xs text-muted mb-3">
                  <span>Recipients: {summary.items.length}</span>
                  <span>Confirmed on-chain: {onChainState?.successCount ?? 0}</span>
                  <span>Failed on-chain: {onChainState?.failCount ?? 0}</span>
                  {onChainState?.totalSent ? (
                    <span>
                      Total settled: {onChainState.totalSent} {run.asset_code}
                    </span>
                  ) : null}
                </div>
                {summary.items.length > 100 ? (
                  <List
                    rowCount={summary.items.length}
                    rowHeight={92}
                    rowComponent={VirtualizedRecipientRow}
                    rowProps={{
                      items: summary.items,
                      run,
                      onChainState,
                      retryingKey,
                      onRetry,
                      // index and style are injected per-row by List at render time
                    }}
                    style={{ height: 400, width: '100%' }}
                  />
                ) : (
                  <div className="space-y-3">
                    {summary.items.map((recipient, index) => (
                      <RecipientRow
                        key={recipient.id}
                        recipient={recipient}
                        index={index}
                        run={run}
                        onChainState={onChainState}
                        retryingKey={retryingKey}
                        onRetry={onRetry}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
interface RecipientRowProps {
  recipient: PayrollRecipientStatus;
  index: number;
  run: PayrollRunRecord;
  onChainState?: OnChainBatchState;
  retryingKey: string | null;
  onRetry: (paymentIndex: number) => void;
  style?: React.CSSProperties;
}

function RecipientRow({
  recipient,
  index,
  run,
  onChainState,
  retryingKey,
  onRetry,
  style,
}: RecipientRowProps) {
  const onChainRecipient = onChainState?.items[index];
  const status =
    onChainRecipient?.status && onChainRecipient.status !== 'unknown'
      ? onChainRecipient.status
      : toRecipientStatus(recipient.status);
  const retryId = `${run.batch_id}:${index}`;

  return (
    <div style={style}>
      <div
        className="grid gap-2 rounded-md border border-hi/30 px-3 py-3 text-xs md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] mb-3"
        style={style ? { marginBottom: 0, height: 'calc(100% - 12px)' } : {}}
      >
        <div className="min-w-0">
          <p className="font-semibold text-text">{getEmployeeName(recipient)}</p>
          {onChainRecipient?.recipient ? (
            <p className="truncate font-mono text-[11px] text-muted">
              {onChainRecipient.recipient}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-muted">Amount</p>
          <p>
            {recipient.amount} {run.asset_code}
          </p>
        </div>
        <div>
          <p className="text-muted">Status</p>
          <p className="capitalize">{status}</p>
        </div>
        <div className="flex items-center justify-end">
          {status === 'failed' ? (
            <button
              type="button"
              onClick={() => onRetry(index)}
              disabled={retryingKey === retryId}
              className="text-danger hover:text-danger/80 disabled:opacity-60"
            >
              {retryingKey === retryId ? 'Retrying...' : 'Retry'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface VirtualizedRowData {
  items: PayrollRecipientStatus[];
  run: PayrollRunRecord;
  onChainState?: OnChainBatchState;
  retryingKey: string | null;
  onRetry: (paymentIndex: number) => void;
}

const VirtualizedRecipientRow = ({
  index,
  style,
  ...data
}: { index: number; style: React.CSSProperties } & VirtualizedRowData) => {
  const recipient = data.items[index];
  return (
    <RecipientRow
      recipient={recipient}
      index={index}
      run={data.run}
      onChainState={data.onChainState}
      retryingKey={data.retryingKey}
      onRetry={data.onRetry}
      style={style}
    />
  );
};
