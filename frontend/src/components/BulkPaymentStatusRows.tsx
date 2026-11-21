import { useTranslation } from 'react-i18next';
import { List } from 'react-window';
import {
  getTxExplorerUrl,
  type OnChainBatchState,
  type PayrollRecipientStatus,
  type PayrollRunRecord,
  type PayrollRunSummary,
} from '../services/bulkPaymentStatus';
import { RecipientRow, VirtualizedRecipientRow } from './BulkPaymentRecipientRows';

interface FragmentRowProps {
  run: PayrollRunRecord;
  liveStatus: string;
  summary?: PayrollRunSummary;
  onChainState?: OnChainBatchState;
  employeeCount: number;
  txHash: string | null;
  confirmationCount: number;
  pendingCount: number;
  progressPercent: number;
  expanded: boolean;
  retryingKey: string | null;
  hasFailedRecipients: boolean;
  justUpdated: boolean;
  recentlyUpdatedItemIds: Set<number>;
  optimisticUpdates: Record<string, PayrollRecipientStatus['status']>;
  onToggleExpand: () => void;
  onRetry: (paymentIndex: number) => void;
}

export function FragmentRow({
  run,
  liveStatus,
  summary,
  onChainState,
  employeeCount,
  txHash,
  confirmationCount,
  pendingCount,
  progressPercent,
  expanded,
  retryingKey,
  hasFailedRecipients,
  justUpdated,
  recentlyUpdatedItemIds,
  optimisticUpdates,
  onToggleExpand,
  onRetry,
}: FragmentRowProps) {
  const { t } = useTranslation();

  return (
    <>
      <tr
        className="bulk-payment-row border-b"
        style={{
          borderColor: 'var(--border-hi)/0.4',
          backgroundColor: justUpdated ? 'var(--success)/0.1' : 'transparent',
        }}
      >
        <td
          className="py-3 pr-4 font-mono"
          style={{
            color: 'var(--text)',
          }}
        >
          {run.batch_id}
        </td>
        <td
          className="py-3 pr-4 capitalize"
          style={{
            color: 'var(--text)',
          }}
        >
          <div className="flex flex-col">
            <span
              className={justUpdated ? 'status-flash' : ''}
              style={{
                color: 'var(--accent)',
              }}
            >
              {liveStatus}
            </span>
            {onChainState?.status ? (
              <span
                className="text-[11px] uppercase tracking-wide"
                style={{
                  color: 'var(--muted)',
                }}
              >
                {t('bulkPaymentTracker.onChainStatus', { status: onChainState.status })}
              </span>
            ) : null}
          </div>
        </td>
        <td className="py-3 pr-4">
          {liveStatus === 'processing' || liveStatus === 'pending' ? (
            <div className="flex flex-col gap-1 min-w-[100px]">
              <div
                className="bulk-payment-progress-bar w-full rounded-full h-1.5 overflow-hidden"
                style={{
                  backgroundColor: 'var(--surface-hi)',
                }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: 'var(--accent)',
                    transition: `width var(--motion-duration-normal) var(--motion-ease-out)`,
                  }}
                />
              </div>
              <span
                className="text-[10px]"
                style={{
                  color: 'var(--muted)',
                }}
              >
                {progressPercent}%
              </span>
              <span
                className="text-[10px]"
                style={{
                  color: 'var(--muted)',
                }}
              >
                {t('bulkPaymentTracker.liveConfirmed', { count: confirmationCount })} ·{' '}
                {t('bulkPaymentTracker.livePending', { count: pendingCount })}
              </span>
            </div>
          ) : (
            <span style={{ color: 'var(--muted)' }}>-</span>
          )}
        </td>
        <td
          className="py-3 pr-4"
          style={{
            color: 'var(--text)',
          }}
        >
          {employeeCount}
        </td>
        <td
          className="py-3 pr-4"
          style={{
            color: 'var(--text)',
          }}
        >
          {run.total_amount} {run.asset_code}
        </td>
        <td
          className="py-3 pr-4"
          style={{
            color: 'var(--text)',
          }}
        >
          {confirmationCount}
        </td>
        <td className="py-3 pr-4">
          {txHash ? (
            <a
              href={getTxExplorerUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="bulk-payment-button"
              style={{
                color: 'var(--accent)',
              }}
            >
              {txHash.slice(0, 10)}...
            </a>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{t('bulkPaymentTracker.notAvailable')}</span>
          )}
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleExpand}
              className="bulk-payment-button"
              style={{
                color: 'var(--accent)',
              }}
            >
              {expanded ? t('bulkPaymentTracker.hide') : t('bulkPaymentTracker.details')}
            </button>
            {hasFailedRecipients ? (
              <span
                className="text-xs"
                style={{
                  color: 'var(--danger)',
                }}
              >
                {t('bulkPaymentTracker.retryAvailableBelow')}
              </span>
            ) : null}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr
          className="border-b"
          style={{
            backgroundColor: 'var(--surface-hi)/0.2',
            borderColor: 'var(--border-hi)/0.4',
          }}
        >
          <td colSpan={8} className="py-3">
            {!summary ? (
              <p
                className="text-sm"
                style={{
                  color: 'var(--muted)',
                  animation: `fadeIn var(--motion-duration-normal) var(--motion-ease-out)`,
                }}
              >
                {t('bulkPaymentTracker.loadingRecipientStatuses')}
              </p>
            ) : (
              <div className="space-y-3">
                <div
                  className="flex flex-wrap items-center gap-4 rounded-md border px-3 py-2 text-xs mb-3"
                  style={{
                    borderColor: 'var(--border-hi)/0.3',
                    color: 'var(--muted)',
                    backgroundColor: 'var(--surface)/0.5',
                  }}
                >
                  <span>{t('bulkPaymentTracker.recipients', { count: summary.items.length })}</span>
                  <span>
                    {t('bulkPaymentTracker.confirmedOnChain', {
                      count: onChainState?.successCount ?? 0,
                    })}
                  </span>
                  <span>
                    {t('bulkPaymentTracker.failedOnChain', {
                      count: onChainState?.failCount ?? 0,
                    })}
                  </span>
                  {onChainState?.totalSent ? (
                    <span>
                      {t('bulkPaymentTracker.totalSettled', {
                        amount: onChainState.totalSent,
                        asset: run.asset_code,
                      })}
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
                      recentlyUpdatedItemIds,
                      optimisticUpdates,
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
                        justUpdated={recentlyUpdatedItemIds.has(recipient.id)}
                        optimisticStatus={optimisticUpdates[`${run.id}:${index}:optimistic`]}
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
