import { useState, useEffect, useRef, useContext } from 'react';
import { Calendar, Check, Copy, Filter, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { List } from 'react-window';
import { useFilterState } from '../hooks/useFilterState';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { useSocket } from '../hooks/useSocket';
import { NotificationContext } from '../hooks/useNotification';
import { useNetworkStore } from '../stores/networkStore';
import { getTxExplorerUrl } from '../utils/stellarExpert';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { Button, Input, Select, Heading, Text, Card } from '@stellar/design-system';
import { CardListSkeleton } from '../components/DataSkeletons';
import { EmptyState } from '../components/EmptyState';
import type { TimelineItem } from '../types/transactionHistory';

const InputComponent = Input as unknown as React.FC<Record<string, unknown>>;
const SelectComponent = Select as unknown as React.FC<Record<string, unknown>>;

const POLLING_INTERVAL_MS = 15_000;
const TRANSACTION_ROW_HEIGHT = 176;

function getStatusClass(status: string): string {
  if (status === 'confirmed' || status === 'indexed') {
    return 'bg-success/10 text-success border border-success/20';
  }
  if (status === 'pending') {
    return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
  }
  return 'bg-danger/10 text-danger border border-danger/20';
}

function copyWithFallback(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'absolute';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  return Promise.resolve();
}

function TransactionSkeleton() {
  return <CardListSkeleton label="Loading transactions" count={6} />;
}

interface VirtualizedTransactionRowProps {
  items: TimelineItem[];
  network: string;
  copiedHash: string | null;
  onCopyHash: (hash: string) => void;
}

const VirtualizedTransactionRow: React.FC<{
  index: number;
  style: React.CSSProperties;
} & VirtualizedTransactionRowProps> = ({
  index,
  style,
  items,
  network,
  copiedHash,
  onCopyHash,
}) => {
  const item = items[index];
  if (!item) return null;

  return (
    <div
      style={{ ...style, paddingBottom: '16px' }}
      data-testid="transaction-row"
    >
      <div className="rounded-2xl border border-hi p-5 hover:bg-surface-hi/40 transition-all hover:scale-[1.005] group motion-route-in bg-surface h-full flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded-md text-[10px] font-bold border border-hi text-muted uppercase tracking-widest bg-surface">
                {item.badge}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusClass(
                  item.status
                )}`}
              >
                {item.status}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-base font-bold text-text group-hover:text-accent transition-colors">
                {item.label}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  Actor:
                </span>
                <span className="text-xs font-mono text-text bg-surface px-1.5 py-0.5 rounded border border-hi">
                  {item.actor}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-text">
                {item.amount} <span className="text-accent2 text-sm">{item.asset}</span>
              </p>
            </div>
          </div>
        </div>

        {item.txHash ? (
          <div className="mt-4 pt-4 border-t border-hi/50 flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-[70%]">
              <a
                href={getTxExplorerUrl(item.txHash, network)}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-accent hover:underline truncate"
                title={item.txHash}
              >
                {item.txHash}
              </a>
              <button
                type="button"
                onClick={() => onCopyHash(item.txHash!)}
                aria-label={`Copy transaction hash ${item.txHash}`}
                className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-accent p-1 rounded hover:bg-surface-hi transition"
                title="Copy transaction hash"
              >
                {copiedHash === item.txHash ? (
                  <Check size={12} className="text-success" aria-hidden="true" />
                ) : (
                  <Copy size={12} aria-hidden="true" />
                )}
                <span className="sr-only">Copy hash</span>
              </button>
            </div>
            <a
              href={getTxExplorerUrl(item.txHash, network)}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
            >
              View Expert
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default function TransactionHistory() {
  const { socket, connected, isPollingFallback } = useSocket();
  const { network } = useNetworkStore();
  const notification = useContext(NotificationContext);
  const [showFilters, setShowFilters] = useState(false);
  const [loadOlderAnnouncement, setLoadOlderAnnouncement] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { filters, debouncedFilters, updateFilter, resetFilters, activeFilterCount } =
    useFilterState();

  const { data, isLoading, isLoadingMore, error, hasMore, fetchNextPage, retry, refetch } =
    useTransactionHistory({
      filters: debouncedFilters,
      page: 1,
      limit: 20,
    });

  const handleCopyHash = (hash: string) => {
    void (async () => {
      try {
        await copyWithFallback(hash);
        notification?.notifySuccess('Transaction hash copied', hash);
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 2000);
      } catch {
        // Fallback
      }
    })();
  };

  useEffect(() => {
    if (!socket) return;

    const onTransactionUpdate = () => {
      void refetch();
    };

    socket.on('transaction:update', onTransactionUpdate);
    return () => {
      socket.off('transaction:update', onTransactionUpdate);
    };
  }, [socket, refetch]);

  // Keyboard shortcuts: / → open filters + focus search; Escape → reset active filters
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '/' && !inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowFilters(true);
        setTimeout(() => {
          document.getElementById('search-filter')?.focus();
        }, 0);
      }

      if (e.key === 'Escape' && !inInput && activeFilterCount > 0) {
        resetFilters();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeFilterCount, resetFilters]);

  useEffect(() => {
    const shouldPoll = !connected || isPollingFallback;

    if (shouldPoll) {
      pollingRef.current = setInterval(() => {
        void refetch();
      }, POLLING_INTERVAL_MS);
    } else {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [connected, isPollingFallback, refetch]);

  const handleLoadOlderRecords = async () => {
    setLoadOlderAnnouncement('Loading older transaction records.');

    try {
      await fetchNextPage();
      setLoadOlderAnnouncement('Older transaction records loaded.');
    } catch {
      setLoadOlderAnnouncement('Unable to load older transaction records.');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 max-w-7xl mx-auto w-full page-fade">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {loadOlderAnnouncement}
      </div>

      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-hi pb-6 gap-4">
        <div>
          <Heading as="h1" size="lg" weight="bold" addlClassName="mb-2 tracking-tight">
            Transaction <span className="text-accent">History</span>
          </Heading>
          <Text
            as="p"
            size="xs"
            weight="regular"
            addlClassName="text-muted font-mono tracking-widest uppercase"
          >
            Unified classic + contract event timeline
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-hi/50 px-3 py-1.5 rounded-xl border border-hi">
            <label
              htmlFor="jump-to-date"
              className="text-xs font-semibold text-muted flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar size={14} aria-hidden="true" />
              <span>Jump to date:</span>
            </label>
            <input
              id="jump-to-date"
              type="date"
              aria-label="Jump to date"
              value={filters.startDate || ''}
              onChange={(e) => {
                updateFilter('startDate', e.target.value);
              }}
              className="bg-transparent text-xs text-text outline-none focus:ring-0 cursor-pointer"
            />
            {filters.startDate && (
              <button
                type="button"
                onClick={() => updateFilter('startDate', '')}
                aria-label="Clear jump date"
                className="text-muted hover:text-danger p-0.5"
                title="Clear jump date"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
          <ConnectionStatus />
          <Link
            to="/help?q=failed+transaction"
            className="text-xs text-muted hover:text-accent underline transition"
          >
            Troubleshoot
          </Link>
          <Button
            size="md"
            variant={showFilters ? 'primary' : 'secondary'}
            onClick={() => {
              setShowFilters((prev) => !prev);
            }}
            icon={<Filter size={18} />}
          >
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card addlClassName="mb-6 p-6 motion-route-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
              Advanced Filters
            </h2>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                title="Reset all filters (Esc)"
                className="text-[10px] font-bold uppercase tracking-widest text-danger hover:underline flex items-center gap-1.5"
              >
                <X size={12} />
                Clear All
                <kbd className="ml-0.5 text-[9px] border border-danger/30 px-1 rounded opacity-60 normal-case">
                  Esc
                </kbd>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="search-filter"
                className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1 flex items-center gap-1.5"
              >
                Search
                <kbd className="text-[9px] border border-hi px-1 rounded opacity-50 normal-case font-mono">
                  /
                </kbd>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 z-10" />
                <InputComponent
                  id="search-filter"
                  fieldSize="md"
                  value={filters.search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateFilter('search', e.target.value)
                  }
                  placeholder="Tx hash / actor..."
                  addlInputClassName="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="status-filter"
                className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1"
              >
                Status
              </label>
              <SelectComponent
                id="status-filter"
                fieldSize="md"
                value={filters.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  updateFilter('status', e.target.value)
                }
              >
                <option value="">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </SelectComponent>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="employee-filter"
                className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1"
              >
                Employee
              </label>
              <InputComponent
                id="employee-filter"
                fieldSize="md"
                value={filters.employee}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateFilter('employee', e.target.value)
                }
                placeholder="Name or wallet..."
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="asset-filter"
                className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1"
              >
                Asset
              </label>
              <InputComponent
                id="asset-filter"
                fieldSize="md"
                value={filters.asset}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateFilter('asset', e.target.value)
                }
                placeholder="USDC, XLM..."
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="start-date-filter"
                className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1"
              >
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 z-10" />
                <InputComponent
                  id="start-date-filter"
                  fieldSize="md"
                  type="date"
                  value={filters.startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateFilter('startDate', e.target.value)
                  }
                  addlInputClassName="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="end-date-filter"
                className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1"
              >
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 z-10" />
                <InputComponent
                  id="end-date-filter"
                  fieldSize="md"
                  type="date"
                  value={filters.endDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateFilter('endDate', e.target.value)
                  }
                  addlInputClassName="pl-10"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card addlClassName="flex-1 p-0 overflow-hidden">
        <div className="p-6">
          {error ? (
            <div className="text-sm text-danger mb-4 font-medium px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center justify-between">
              <span>
                {error instanceof Error ? error.message : 'Failed to load transaction history'}
              </span>
              <Button size="sm" variant="destructive" onClick={() => retry()}>
                Retry
              </Button>
            </div>
          ) : null}
          {isLoading ? <TransactionSkeleton /> : null}

          {!isLoading && (!data || data.length === 0) ? (
            <EmptyState
              illustration={activeFilterCount > 0 ? 'search' : 'transactions'}
              title={activeFilterCount > 0 ? 'No transactions found' : 'No transactions yet'}
              description={
                activeFilterCount > 0
                  ? 'Try adjusting your filters.'
                  : 'Your payroll history will appear here once payments are sent.'
              }
              secondaryAction={
                activeFilterCount > 0
                  ? { label: 'Clear filters', onClick: resetFilters }
                  : undefined
              }
            />
          ) : null}

          {!isLoading && data && data.length > 0 ? (
            <div
              className="h-[min(70vh,720px)] min-h-[300px] w-full"
              role="feed"
              aria-label="Transaction history list"
            >
              <List
                rowCount={data.length}
                rowHeight={TRANSACTION_ROW_HEIGHT}
                rowComponent={VirtualizedTransactionRow}
                rowProps={{
                  items: data,
                  network,
                  copiedHash,
                  onCopyHash: handleCopyHash,
                }}
                overscanCount={5}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
          ) : null}

          {!isLoading && hasMore ? (
            <div className="mt-8 mb-4 flex justify-center">
              {isLoadingMore ? (
                <div
                  className="w-40 h-10 bg-surface-hi rounded-xl animate-pulse"
                  aria-label="Loading more transactions"
                />
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleLoadOlderRecords()}
                  disabled={isLoadingMore}
                >
                  Load older records
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
