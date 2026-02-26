import { useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, Filter, Search } from 'lucide-react';
import {
  fetchHistoryPage,
  type HistoryFilters,
  type TimelineItem,
} from '../services/transactionHistory';

const DEFAULT_FILTERS: HistoryFilters = {
  search: '',
  status: '',
  employee: '',
  asset: '',
  startDate: '',
  endDate: '',
};

function getStatusClass(status: string): string {
  if (status === 'confirmed' || status === 'indexed') {
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  }
  if (status === 'pending') {
    return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
  }
  return 'bg-red-500/10 text-red-400 border border-red-500/20';
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="animate-pulse rounded-xl border border-zinc-800 p-4">
          <div className="h-3 w-40 bg-zinc-800 rounded mb-2" />
          <div className="h-3 w-64 bg-zinc-800 rounded mb-2" />
          <div className="h-3 w-28 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function TransactionHistory() {
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1);
    }, 350);

    return () => {
      clearTimeout(timeout);
    };
  }, [filters]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchHistoryPage({
          page: 1,
          limit: 20,
          filters: debouncedFilters,
        });
        setItems(result.items);
        setHasMore(result.hasMore);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load transaction history'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [debouncedFilters]);

  const activeFilterCount = useMemo(
    () => (Object.values(filters) as string[]).filter((value) => value.trim().length > 0).length,
    [filters]
  );

  const loadMore = async () => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const result = await fetchHistoryPage({
        page: nextPage,
        limit: 20,
        filters: debouncedFilters,
      });
      setItems((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load more history');
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            Transaction <span className="text-accent">History</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm tracking-wider uppercase">
            Unified classic + contract event timeline
          </p>
        </div>
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 bg-zinc-800/50 text-white hover:bg-zinc-800 transition-all"
        >
          <Filter size={18} />
          Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="bg-[#16161a] border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
                placeholder="Search tx hash / actor"
                className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm"
              />
            </div>

            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="bg-[#0a0a0c] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            <input
              value={filters.employee}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, employee: event.target.value }))
              }
              placeholder="Employee"
              className="bg-[#0a0a0c] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm"
            />

            <input
              value={filters.asset}
              onChange={(event) => setFilters((prev) => ({ ...prev, asset: event.target.value }))}
              placeholder="Asset (USDC, XLM...)"
              className="bg-[#0a0a0c] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm"
            />

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, startDate: event.target.value }))
                }
                className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, endDate: event.target.value }))
                }
                className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#16161a] border border-zinc-800 rounded-xl p-5 flex-1">
        {error ? <p className="text-sm text-red-400 mb-4">{error}</p> : null}
        {isLoading ? <TimelineSkeleton /> : null}

        {!isLoading && items.length === 0 ? (
          <div className="text-zinc-500 text-center py-16">
            <Activity className="w-8 h-8 opacity-30 mx-auto mb-3" />
            <p className="text-sm">No records found for current filters.</p>
          </div>
        ) : null}

        {!isLoading && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 p-4 hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md text-[11px] border border-zinc-700 text-zinc-300">
                    {item.badge}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase ${getStatusClass(item.status)}`}
                  >
                    {item.status}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-zinc-400 mt-1">Actor: {item.actor}</p>
                <p className="text-xs text-zinc-400">
                  Amount: {item.amount} {item.asset}
                </p>
                {item.txHash ? (
                  <p className="text-xs text-blue-400 font-mono mt-1 break-all">{item.txHash}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && hasMore ? (
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => {
                void loadMore();
              }}
              disabled={isLoadingMore}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold disabled:opacity-70"
            >
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
