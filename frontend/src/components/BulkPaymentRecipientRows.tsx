import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { RowComponentProps } from 'react-window';
import type {
  OnChainBatchState,
  PayrollRecipientStatus,
  PayrollRunRecord,
} from '../services/bulkPaymentStatus';
import { getEmployeeName, getRetryKey, resolveRecipientStatus } from '../utils/bulkPaymentStatus';

interface RecipientRowProps {
  recipient: PayrollRecipientStatus;
  index: number;
  run: PayrollRunRecord;
  onChainState?: OnChainBatchState;
  retryingKey: string | null;
  onRetry: (paymentIndex: number) => void;
  justUpdated?: boolean;
  optimisticStatus?: PayrollRecipientStatus['status'];
  style?: CSSProperties;
}

export function RecipientRow({
  recipient,
  index,
  run,
  onChainState,
  retryingKey,
  onRetry,
  justUpdated,
  optimisticStatus,
  style,
}: RecipientRowProps) {
  const { t } = useTranslation();
  const onChainRecipient = onChainState?.items[index];
  const status = resolveRecipientStatus(recipient, onChainRecipient, optimisticStatus);
  const retryId = getRetryKey(run.batch_id, index);

  return (
    <div style={style}>
      <div
        className="bulk-payment-recipient-row grid gap-2 rounded-md border px-3 py-3 text-xs md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] mb-3"
        style={{
          borderColor: 'var(--border-hi)/0.3',
          ...((style && { marginBottom: 0, height: 'calc(100% - 12px)' }) || {}),
        }}
      >
        <div className="min-w-0">
          <p
            className="font-semibold"
            style={{
              color: 'var(--text)',
            }}
          >
            {getEmployeeName(recipient, t)}
          </p>
          {onChainRecipient?.recipient ? (
            <p
              className="truncate font-mono text-[11px]"
              style={{
                color: 'var(--muted)',
              }}
            >
              {onChainRecipient.recipient}
            </p>
          ) : null}
        </div>
        <div>
          <p
            style={{
              color: 'var(--muted)',
            }}
          >
            {t('bulkPaymentTracker.amount')}
          </p>
          <p
            style={{
              color: 'var(--text)',
            }}
          >
            {recipient.amount} {run.asset_code}
          </p>
        </div>
        <div>
          <p
            style={{
              color: 'var(--muted)',
            }}
          >
            {t('bulkPaymentTracker.columnStatus')}
          </p>
          <p
            className={`capitalize ${justUpdated || optimisticStatus ? 'status-flash' : ''}`}
            style={{
              color: 'var(--text)',
            }}
          >
            {status}
          </p>
        </div>
        <div className="flex items-center justify-end">
          {status === 'failed' ? (
            <button
              type="button"
              onClick={() => onRetry(index)}
              disabled={retryingKey === retryId}
              className="bulk-payment-button disabled:opacity-60"
              style={{
                color: 'var(--danger)',
              }}
            >
              {retryingKey === retryId
                ? t('bulkPaymentTracker.retrying')
                : t('bulkPaymentTracker.retry')}
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
  recentlyUpdatedItemIds: Set<number>;
  optimisticUpdates: Record<string, PayrollRecipientStatus['status']>;
}

export function VirtualizedRecipientRow({
  index,
  style,
  ...data
}: RowComponentProps<VirtualizedRowData>) {
  const recipient = data.items[index];
  return (
    <RecipientRow
      recipient={recipient}
      index={index}
      run={data.run}
      onChainState={data.onChainState}
      retryingKey={data.retryingKey}
      onRetry={data.onRetry}
      justUpdated={data.recentlyUpdatedItemIds.has(recipient.id)}
      optimisticStatus={data.optimisticUpdates[`${data.run.id}:${index}:optimistic`]}
      style={style}
    />
  );
}
