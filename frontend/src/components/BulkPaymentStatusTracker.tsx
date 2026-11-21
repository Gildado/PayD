import { useTranslation } from 'react-i18next';
import { useBulkPaymentStatus } from '../hooks/useBulkPaymentStatus';
import type { BulkStatusFilter } from '../utils/bulkPaymentStatus';
import { ConnectionStatus } from './ConnectionStatus';
import { FragmentRow } from './BulkPaymentStatusRows';
import { SkeletonLoader } from './SkeletonLoader';

interface BulkPaymentStatusTrackerProps {
  organizationId: number;
}

export function BulkPaymentStatusTracker({ organizationId }: BulkPaymentStatusTrackerProps) {
  const { t } = useTranslation();
  const {
    rows,
    expandedRunId,
    isLoading,
    isRetryingKey,
    error,
    statusFilter,
    setStatusFilter,
    recentlyUpdatedItemIds,
    recentlyUpdatedRunIds,
    optimisticUpdates,
    refresh,
    toggleExpand,
    retry,
  } = useBulkPaymentStatus(organizationId);

  return (
    <div className="card glass noise mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3
          className="text-lg font-bold"
          style={{
            color: 'var(--text)',
          }}
        >
          {t('bulkPaymentTracker.title')}
        </h3>
        <div className="flex items-center gap-4">
          <ConnectionStatus />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BulkStatusFilter)}
            className="dropdown-select"
          >
            <option value="All">{t('bulkPaymentTracker.allStatuses')}</option>
            <option value="Completed">{t('bulkPaymentTracker.completed')}</option>
            <option value="Pending">{t('bulkPaymentTracker.pending')}</option>
            <option value="Failed">{t('bulkPaymentTracker.failed')}</option>
          </select>
          <button
            type="button"
            onClick={refresh}
            className="bulk-payment-button text-xs font-semibold"
            style={{
              color: 'var(--accent)',
            }}
          >
            {t('bulkPaymentTracker.refresh')}
          </button>
        </div>
      </div>

      {error ? (
        <p
          className="text-sm"
          style={{
            color: 'var(--danger)',
            animation: `fadeIn var(--motion-duration-normal) var(--motion-ease-out)`,
          }}
        >
          {error}
        </p>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? t('bulkPaymentTracker.loadingRuns') : ''}
      </span>

      {!isLoading && rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {t('bulkPaymentTracker.noRunsFound')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="bulk-payment-table w-full text-sm">
            <thead
              className="text-left border-b"
              style={{
                color: 'var(--muted)',
                borderColor: 'var(--border-hi)',
              }}
            >
              <tr>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnBatch')}</th>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnStatus')}</th>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnProgress')}</th>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnEmployees')}</th>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnTotal')}</th>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnConfirmations')}</th>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnTxHash')}</th>
                <th className="py-2 pr-4">{t('bulkPaymentTracker.columnActions')}</th>
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
                  pendingCount,
                  liveStatus,
                  progressPercent,
                  hasFailedRecipients,
                }) => (
                  <FragmentRow
                    key={run.id}
                    run={run}
                    liveStatus={liveStatus}
                    summary={summary}
                    onChainState={onChainState}
                    employeeCount={employeeCount}
                    txHash={txHash}
                    confirmationCount={confirmationCount}
                    pendingCount={pendingCount}
                    progressPercent={progressPercent}
                    expanded={expandedRunId === run.id}
                    retryingKey={isRetryingKey}
                    hasFailedRecipients={hasFailedRecipients}
                    justUpdated={recentlyUpdatedRunIds.has(run.id)}
                    recentlyUpdatedItemIds={recentlyUpdatedItemIds}
                    optimisticUpdates={optimisticUpdates}
                    onToggleExpand={() => {
                      void toggleExpand(run.id);
                    }}
                    onRetry={(paymentIndex) => {
                      void retry(run, paymentIndex);
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
