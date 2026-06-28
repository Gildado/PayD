import { useState, useEffect, useRef } from 'react';
import { Activity, Calendar, Filter, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFilterState } from '../hooks/useFilterState';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { useSocket } from '../hooks/useSocket';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { Button, Input, Select, Heading, Text, Card } from '@stellar/design-system';

const InputComponent = Input as unknown as React.FC<Record<string, unknown>>;
const SelectComponent = Select as unknown as React.FC<Record<string, unknown>>;

const POLLING_INTERVAL_MS = 15_000;

function getStatusClass(status: string): string {
  if (status === 'confirmed' || status === 'indexed') {
    return 'bg-success/10 text-success border border-success/20';
  }
  if (status === 'pending') {
    return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
  }
  return 'bg-danger/10 text-danger border border-danger/20';
}

function getTxExplorerUrl(hash: string): string {
  return `https://stellar.expert/explorer/public/tx/${hash}`;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {['s1', 's2', 's3', 's4', 's5', 's6'].map((key) => (
        <Card key={key} addlClassName="animate-pulse bg-surface-hi/20">
          <div className="h-3 w-40 bg-border-hi rounded mb-2" />
          <div className="h-3 w-64 bg-border-hi rounded mb-2" />
          <div className="h-3 w-28 bg-border-hi rounded" />
        </Card>
      ))}
    </div>
  );
}

export default function TransactionHistory() {
  useTranslation();
  const { socket, connected, isPollingFallback } = useSocket();
  const [showFilters, setShowFilters] = useState(false);
  const [loadOlderAnnouncement, setLoadOlderAnnouncement] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { filters, debouncedFilters, updateFilter, resetFilters, activeFilterCount } =
    useFilterState();

  const { data, isLoading, isLoadingMore, error, hasMore, fetchNextPage, retry, refetch } =
    useTransactionHistory({
      filters: debouncedFilters,
      page: 1,
      limit: 20,
    });

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
        <div className="flex items-center gap-3">
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
            onClick={() => setShowFilters((prev) => !prev)}
            icon={<Filter size={18} />}
          >
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card addlClassName="mb-6 p-6 animate-fadeUp">
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
          {isLoading ? <TimelineSkeleton /> : null}

          {!isLoading && (!data || data.length === 0) ? (
            <div className="text-muted text-center py-24">
              <div className="w-16 h-16 rounded-full bg-surface-hi flex items-center justify-center mx-auto mb-6 border border-hi">
                <Activity className="w-8 h-8 opacity-40 text-muted" />
              </div>
              <p className="text-lg font-bold text-text mb-1">
                {activeFilterCount > 0 ? 'No transactions found' : 'No transactions yet'}
              </p>
              <p className="text-sm">
                {activeFilterCount > 0
                  ? 'Try adjusting your filters.'
                  : 'Your payroll history will appear here once payments are sent.'}
              </p>
            </div>
          ) : null}

          {!isLoading && data && data.length > 0 ? (
            <div className="space-y-4">
              {data.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-hi p-5 hover:bg-surface-hi/40 transition-all hover:scale-[1.005] group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-md text-[10px] font-bold border border-hi text-muted uppercase tracking-widest bg-surface">
                        {item.badge}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusClass(item.status)}`}
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

                  {item.txHash ? (
                    <div className="mt-4 pt-4 border-t border-hi/50 flex items-center justify-between">
                      <a
                        href={getTxExplorerUrl(item.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono text-accent hover:underline truncate max-w-[70%]"
                        title={item.txHash}
                      >
                        {item.txHash}
                      </a>
                      <a
                        href={getTxExplorerUrl(item.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-accent hover:underline uppercase tracking-widest"
                      >
                        View Expert
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {!isLoading && hasMore ? (
            <div className="mt-8 mb-4 flex justify-center">
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleLoadOlderRecords()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading data...' : 'Load older records'}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
