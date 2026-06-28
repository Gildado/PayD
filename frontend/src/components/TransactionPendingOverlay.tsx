import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ExternalLink, Loader2, X, XCircle } from 'lucide-react';
import { Text } from '@stellar/design-system';
import { useWallet } from '../hooks/useWallet';
import { getTxExplorerUrl } from '../utils/stellarExpert';

export interface PendingTransaction {
  id: string;
  type: string;
  status: 'pending' | 'confirmed' | 'failed';
  hash?: string;
  timestamp: number;
  description?: string;
}

interface TransactionPendingOverlayProps {
  transactions: PendingTransaction[];
  onDismiss?: (id: string) => void;
}

function getStatusLabel(status: PendingTransaction['status']) {
  if (status === 'confirmed') return 'Transaction confirmed';
  if (status === 'failed') return 'Transaction failed';
  return 'Transaction pending';
}

function getFormattedTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const TransactionPendingOverlay: React.FC<TransactionPendingOverlayProps> = ({
  transactions,
  onDismiss,
}) => {
  const { network } = useWallet();
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setVisible((previous) => {
      const nextVisible = { ...previous };
      let hasChanges = false;

      transactions.forEach((transaction) => {
        if (!(transaction.id in previous)) {
          nextVisible[transaction.id] = true;
          hasChanges = true;
        }
      });

      return hasChanges ? nextVisible : previous;
    });
  }, [transactions]);

  const handleDismiss = (id: string) => {
    setVisible((previous) => ({ ...previous, [id]: false }));
    window.setTimeout(() => {
      onDismiss?.(id);
    }, 300);
  };

  const visibleTransactions = transactions.filter((transaction) => visible[transaction.id]);

  if (visibleTransactions.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex w-auto flex-col gap-3 sm:inset-x-auto sm:right-6 sm:w-full sm:max-w-md"
      role="region"
      aria-live="polite"
      aria-label="Transaction notifications"
    >
      {visibleTransactions.map((transaction) => {
        const title = getStatusLabel(transaction.status);
        const explorerUrl = transaction.hash ? getTxExplorerUrl(transaction.hash, network) : null;

        return (
          <article
            key={transaction.id}
            className={`pointer-events-auto rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)] shadow-2xl backdrop-blur-xl transition-all duration-300 ${
              visible[transaction.id] ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            }`}
            style={{
              background: 'color-mix(in srgb, var(--surface) 95%, transparent)',
            }}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {transaction.status === 'pending' ? (
                    <Loader2
                      className="h-5 w-5 animate-spin text-[var(--accent)]"
                      aria-hidden="true"
                    />
                  ) : null}
                  {transaction.status === 'confirmed' ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden="true" />
                  ) : null}
                  {transaction.status === 'failed' ? (
                    <XCircle className="h-5 w-5 text-[var(--danger)]" aria-hidden="true" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Text as="p" size="sm" weight="bold" addlClassName="text-[var(--text)]">
                      {title}
                    </Text>
                    <span className="rounded-full border border-hi bg-black/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {transaction.type}
                    </span>
                  </div>

                  <Text as="p" size="xs" addlClassName="mb-2 line-clamp-2 text-[var(--muted)]">
                    {transaction.description || `${transaction.type} transaction`}
                  </Text>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {getFormattedTimestamp(transaction.timestamp)}
                    </span>

                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent2)]"
                        aria-label={`View transaction ${transaction.id} on Stellar Expert`}
                      >
                        <span>View on explorer</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </div>

                {transaction.status !== 'pending' ? (
                  <button
                    type="button"
                    onClick={() => handleDismiss(transaction.id)}
                    className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-white/5 hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    aria-label={`Dismiss notification for ${transaction.type}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {transaction.status === 'pending' ? (
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--border-hi)]">
                  <div
                    className="h-full w-3/5 animate-pulse bg-[var(--accent)]"
                    style={{
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                  />
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
};
