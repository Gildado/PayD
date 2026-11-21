import type {
  OnChainBatchState,
  OnChainPaymentStatus,
  PayrollRecipientStatus,
  PayrollRunRecord,
  PayrollRunSummary,
} from '../services/bulkPaymentStatus';

export type BulkStatusFilter = 'All' | 'Completed' | 'Pending' | 'Failed';

export interface BulkSocketUpdate {
  batchId: string;
  status: string | null;
  progress: number | null;
  completedCount: number | null;
  totalItems: number | null;
  lastTxHash: string | null;
}

export type BulkSocketUpdateMap = Record<string, BulkSocketUpdate>;
export type ConfirmationMap = Record<string, number>;
export type OnChainStateMap = Record<number, OnChainBatchState>;

export interface BulkRunRow {
  run: PayrollRunRecord;
  summary?: PayrollRunSummary;
  onChainState?: OnChainBatchState;
  employeeCount: number;
  txHash: string | null;
  confirmationCount: number;
  pendingCount: number;
  liveStatus: string;
  progressPercent: number;
  hasFailedRecipients: boolean;
}

export function toRecipientStatus(
  status: PayrollRecipientStatus['status']
): 'pending' | 'confirmed' | 'failed' {
  if (status === 'completed') return 'confirmed';
  if (status === 'failed') return 'failed';
  return 'pending';
}

export function getEmployeeName(
  recipient: PayrollRecipientStatus,
  t: (key: string, opts?: Record<string, string | number>) => string
): string {
  const fullName =
    `${recipient.employee_first_name ?? ''} ${recipient.employee_last_name ?? ''}`.trim();
  return (
    fullName ||
    recipient.employee_email ||
    t('bulkPaymentTracker.employeeNumber', { id: recipient.employee_id })
  );
}

export function findRunTxHash(summary?: PayrollRunSummary): string | null {
  if (!summary) return null;
  const txHash = summary.items.find((item) => Boolean(item.tx_hash))?.tx_hash;
  return txHash || null;
}

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeBulkUpdatePayload(payload: unknown): BulkSocketUpdate | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const batchId =
    (record.batchId as string | undefined) ||
    (record.batch_id as string | undefined) ||
    (record.runId as string | undefined) ||
    null;

  if (!batchId) return null;

  // The worker emits `completedCount`; the legacy aliases below are kept for
  // compatibility with older/alternate event shapes.
  const completedCount = toNumberOrNull(
    record.completedCount ??
      record.confirmations ??
      record.confirmationCount ??
      record.confirmed ??
      record.count
  );

  return {
    batchId,
    status: typeof record.status === 'string' ? record.status : null,
    progress: toNumberOrNull(record.progress),
    completedCount,
    totalItems: toNumberOrNull(record.totalItems ?? record.total),
    lastTxHash: typeof record.lastTxHash === 'string' ? record.lastTxHash : null,
  };
}

export interface BuildRunRowsOptions {
  runs: PayrollRunRecord[];
  summaries: Record<number, PayrollRunSummary>;
  onChainStates: OnChainStateMap;
  socketUpdates: BulkSocketUpdateMap;
  statusFilter: BulkStatusFilter;
}

export function buildRunRows({
  runs,
  summaries,
  onChainStates,
  socketUpdates,
  statusFilter,
}: BuildRunRowsOptions): BulkRunRow[] {
  return runs
    .map((run) => {
      const summary = summaries[run.id];
      const onChainState = onChainStates[run.id];
      const socketUpdate = socketUpdates[run.batch_id];
      const employeeCount = summary?.summary.total_employees ?? summary?.items.length ?? 0;
      const txHash = findRunTxHash(summary);
      const confirmationCount = socketUpdate?.completedCount ?? onChainState?.successCount ?? 0;
      const totalCount = socketUpdate?.totalItems ?? employeeCount;
      const pendingCount = Math.max(totalCount - confirmationCount, 0);
      // Prefer the live socket status over the last REST-fetched run status
      // so the badge reflects the real-time state without a manual refresh.
      const liveStatus = socketUpdate?.status ?? run.status;
      // Prefer the worker's own computed progress; fall back to deriving it
      // from counts (e.g. before any socket event has arrived for this run).
      const progressPercent =
        socketUpdate?.progress ??
        (employeeCount > 0 ? Math.round((confirmationCount / employeeCount) * 100) : 0);
      const hasFailedRecipients = summary?.items.some((item) => item.status === 'failed') ?? false;

      return {
        run,
        summary,
        onChainState,
        employeeCount,
        txHash,
        confirmationCount,
        pendingCount,
        liveStatus,
        progressPercent,
        hasFailedRecipients,
      };
    })
    .filter((row) => {
      if (statusFilter === 'All') return true;
      return row.liveStatus.toLowerCase() === statusFilter.toLowerCase();
    });
}

export function getRetryKey(batchId: string, paymentIndex: number): string {
  return `${batchId}:${paymentIndex}`;
}

export function resolveRecipientStatus(
  recipient: PayrollRecipientStatus,
  onChainRecipient?: OnChainPaymentStatus,
  optimisticStatus?: PayrollRecipientStatus['status']
): PayrollRecipientStatus['status'] | OnChainPaymentStatus['status'] {
  const baseStatus =
    onChainRecipient?.status && onChainRecipient.status !== 'unknown'
      ? onChainRecipient.status
      : toRecipientStatus(recipient.status);
  return optimisticStatus ?? baseStatus;
}
