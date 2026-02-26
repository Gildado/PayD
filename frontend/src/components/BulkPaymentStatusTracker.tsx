import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { useWallet } from '../hooks/useWallet';
import { useWalletSigning } from '../hooks/useWalletSigning';
import { contractService } from '../services/contracts';
import {
  fetchPayrollRuns,
  fetchPayrollRunSummary,
  getTxExplorerUrl,
  retryFailedBatch,
  type PayrollRecipientStatus,
  type PayrollRunRecord,
  type PayrollRunSummary,
} from '../services/bulkPaymentStatus';

interface BulkPaymentStatusTrackerProps {
  organizationId: number;
}

type ConfirmationMap = Record<string, number>;

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
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [confirmations, setConfirmations] = useState<ConfirmationMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRetryingBatchId, setIsRetryingBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { notifyError, notifySuccess } = useNotification();
  const { socket } = useSocket();
  const { address } = useWallet();
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
      notifyError('Bulk payment load failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [notifyError, organizationId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const loadSummary = useCallback(
    async (runId: number) => {
      if (summaries[runId]) return;
      try {
        const summary = await fetchPayrollRunSummary(runId);
        setSummaries((prev) => ({ ...prev, [runId]: summary }));
      } catch (summaryError) {
        const message =
          summaryError instanceof Error
            ? summaryError.message
            : 'Failed to load per-recipient status';
        notifyError('Failed to load batch details', message);
      }
    },
    [notifyError, summaries]
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
    await loadSummary(runId);
  };

  const handleRetry = async (run: PayrollRunRecord) => {
    if (!address) {
      notifyError('Wallet required', 'Connect a wallet before retrying failed recipients.');
      return;
    }

    const summary = summaries[run.id];
    const hasFailedRecipients = summary?.items.some((item) => item.status === 'failed');
    if (!hasFailedRecipients) return;

    setIsRetryingBatchId(run.batch_id);
    try {
      await contractService.initialize();
      const contractId =
        contractService.getContractId('bulk_payment', 'testnet') ||
        (import.meta.env.VITE_BULK_PAYMENT_CONTRACT_ID as string | undefined);

      if (!contractId) {
        throw new Error('Bulk payment contract ID is unavailable.');
      }

      const { txHash } = await retryFailedBatch({
        contractId,
        batchId: run.batch_id,
        sourceAddress: address,
        signTransaction: sign,
      });

      notifySuccess('Retry submitted', `Batch ${run.batch_id} was re-invoked. TX: ${txHash}`);
      await loadSummary(run.id);
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : 'Retry failed';
      notifyError('Retry failed', message);
    } finally {
      setIsRetryingBatchId(null);
    }
  };

  const rows = useMemo(() => {
    return runs.map((run) => {
      const summary = summaries[run.id];
      const employeeCount = summary?.summary.total_employees ?? 0;
      const txHash = findRunTxHash(summary);
      const confirmationCount = confirmations[run.batch_id] ?? 0;
      const hasFailedRecipients = summary?.items.some((item) => item.status === 'failed') ?? false;

      return {
        run,
        summary,
        employeeCount,
        txHash,
        confirmationCount,
        hasFailedRecipients,
      };
    });
  }, [confirmations, runs, summaries]);

  return (
    <div className="card glass noise mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">Bulk Payment Status Tracker</h3>
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

      {isLoading ? <p className="text-sm text-muted">Loading bulk payroll runs...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!isLoading && rows.length === 0 ? (
        <p className="text-sm text-muted">No payroll batch runs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted border-b border-hi">
              <tr>
                <th className="py-2 pr-4">Batch</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Employees</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Confirmations</th>
                <th className="py-2 pr-4">Tx Hash</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({
                  run,
                  summary,
                  employeeCount,
                  txHash,
                  confirmationCount,
                  hasFailedRecipients,
                }) => (
                  <FragmentRow
                    key={run.id}
                    run={run}
                    summary={summary}
                    employeeCount={employeeCount}
                    txHash={txHash}
                    confirmationCount={confirmationCount}
                    expanded={expandedRunId === run.id}
                    retrying={isRetryingBatchId === run.batch_id}
                    hasFailedRecipients={hasFailedRecipients}
                    onToggleExpand={() => {
                      void handleToggleExpand(run.id);
                    }}
                    onRetry={() => {
                      void handleRetry(run);
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
  employeeCount: number;
  txHash: string | null;
  confirmationCount: number;
  expanded: boolean;
  retrying: boolean;
  hasFailedRecipients: boolean;
  onToggleExpand: () => void;
  onRetry: () => void;
}

function FragmentRow({
  run,
  summary,
  employeeCount,
  txHash,
  confirmationCount,
  expanded,
  retrying,
  hasFailedRecipients,
  onToggleExpand,
  onRetry,
}: FragmentRowProps) {
  return (
    <>
      <tr className="border-b border-hi/40">
        <td className="py-3 pr-4 font-mono">{run.batch_id}</td>
        <td className="py-3 pr-4 capitalize">{run.status}</td>
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
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="text-danger hover:text-danger/80 disabled:opacity-60"
              >
                {retrying ? 'Retrying...' : 'Retry Failed'}
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-hi/40 bg-black/10">
          <td colSpan={7} className="py-3">
            {!summary ? (
              <p className="text-sm text-muted">Loading recipient statuses...</p>
            ) : (
              <div className="space-y-2">
                {summary.items.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between rounded-md border border-hi/30 px-3 py-2 text-xs"
                  >
                    <span>{getEmployeeName(recipient)}</span>
                    <span>
                      {recipient.amount} {run.asset_code}
                    </span>
                    <span className="capitalize">{toRecipientStatus(recipient.status)}</span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
