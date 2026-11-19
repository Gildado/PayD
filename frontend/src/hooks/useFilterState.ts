import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HistoryFilters, UseFilterStateResult } from '../types/transactionHistory';

/**
 * Valid column keys for EmployeeList that can be sorted or toggled for visibility.
 */
export type EmployeeColumnKey = 'name' | 'position' | 'wallet' | 'salary' | 'status';

export const ALL_EMPLOYEE_COLUMNS: EmployeeColumnKey[] = [
  'name',
  'position',
  'wallet',
  'salary',
  'status',
];

export interface EmployeeFilters {
  search: string;
  status: 'All' | 'Active' | 'Inactive';
  sortKey: EmployeeColumnKey;
  sortAsc: boolean;
  visibleColumns: EmployeeColumnKey[];
}

export interface UseEmployeeFilterStateResult {
  filters: EmployeeFilters;
  debouncedSearch: string;
  searchQuery: string;
  setSearch: (query: string) => void;
  setSearchQuery: (query: string) => void;
  statusFilter: 'All' | 'Active' | 'Inactive';
  setStatus: (status: 'All' | 'Active' | 'Inactive') => void;
  setStatusFilter: (status: 'All' | 'Active' | 'Inactive') => void;
  sortKey: EmployeeColumnKey;
  sortAsc: boolean;
  setSort: (key: EmployeeColumnKey, asc?: boolean) => void;
  toggleSort: (key: EmployeeColumnKey) => void;
  handleSort: (key: EmployeeColumnKey) => void;
  toggleColumn: (col: EmployeeColumnKey) => void;
  toggleColumnVisibility: (col: EmployeeColumnKey) => void;
  visibleColumns: EmployeeColumnKey[];
  setVisibleColumns: (cols: EmployeeColumnKey[]) => void;
  resetFilters: () => void;
  clearFilters: () => void;
}

/**
 * Custom hook for EmployeeList state synchronized with URL search parameters.
 * Persists column visibility, sort key, sort direction, and filter state (search, status) in query params.
 * Safely restores state on load and ignores invalid URL parameters.
 */
export function useEmployeeFilterState(): UseEmployeeFilterStateResult {
  let searchParams: URLSearchParams;
  let setSearchParams: ((params: URLSearchParams, opts?: { replace?: boolean }) => void) | null =
    null;

  try {
    const [params, setParams] = useSearchParams();
    searchParams = params;
    setSearchParams = setParams;
  } catch {
    // Graceful fallback when rendered outside a React Router context (e.g. unit tests)
    searchParams =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
  }

  const getInitialFilters = useCallback((): EmployeeFilters => {
    // 1. Search text
    const search = searchParams.get('search') ?? searchParams.get('q') ?? '';

    // 2. Status: only 'Active' or 'Inactive', default 'All'
    const statusParam = searchParams.get('status');
    const status: 'All' | 'Active' | 'Inactive' =
      statusParam === 'Active' || statusParam === 'Inactive' ? statusParam : 'All';

    // 3. Sort key: must be valid EmployeeColumnKey, default 'name'
    const sortParam = searchParams.get('sort') ?? searchParams.get('sortKey');
    const sortKey: EmployeeColumnKey =
      sortParam && ALL_EMPLOYEE_COLUMNS.includes(sortParam as EmployeeColumnKey)
        ? (sortParam as EmployeeColumnKey)
        : 'name';

    // 4. Sort direction: 'desc' or 'asc', default true (ascending)
    const orderParam = searchParams.get('order') ?? searchParams.get('sortDir');
    const sortAscParam = searchParams.get('sortAsc');
    const sortAsc = orderParam === 'desc' || sortAscParam === 'false' ? false : true;

    // 5. Visible columns
    const columnsParam = searchParams.get('columns') ?? searchParams.get('cols');
    let visibleColumns: EmployeeColumnKey[] = ALL_EMPLOYEE_COLUMNS;
    if (columnsParam) {
      const parsed = columnsParam
        .split(',')
        .map((c) => c.trim())
        .filter((c): c is EmployeeColumnKey => ALL_EMPLOYEE_COLUMNS.includes(c as EmployeeColumnKey));
      if (parsed.length > 0) {
        visibleColumns = parsed;
      }
    }

    return {
      search,
      status,
      sortKey,
      sortAsc,
      visibleColumns,
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<EmployeeFilters>(getInitialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(handler);
  }, [filters.search]);

  // Sync state back to URL query parameters
  useEffect(() => {
    if (!setSearchParams) return;

    const params = new URLSearchParams(searchParams.toString());

    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    } else {
      params.delete('search');
      params.delete('q');
    }

    if (filters.status !== 'All') {
      params.set('status', filters.status);
    } else {
      params.delete('status');
    }

    if (filters.sortKey !== 'name') {
      params.set('sort', filters.sortKey);
    } else {
      params.delete('sort');
      params.delete('sortKey');
    }

    if (!filters.sortAsc) {
      params.set('order', 'desc');
    } else {
      params.delete('order');
      params.delete('sortDir');
      params.delete('sortAsc');
    }

    if (
      filters.visibleColumns.length < ALL_EMPLOYEE_COLUMNS.length &&
      filters.visibleColumns.length > 0
    ) {
      params.set('columns', filters.visibleColumns.join(','));
    } else {
      params.delete('columns');
      params.delete('cols');
    }

    setSearchParams(params, { replace: true });
  }, [
    debouncedSearch,
    filters.status,
    filters.sortKey,
    filters.sortAsc,
    filters.visibleColumns,
    searchParams,
    setSearchParams,
  ]);

  const setSearch = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, search: query }));
  }, []);

  const setStatus = useCallback((status: 'All' | 'Active' | 'Inactive') => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const setSort = useCallback((key: EmployeeColumnKey, asc?: boolean) => {
    setFilters((prev) => ({
      ...prev,
      sortKey: key,
      sortAsc: asc !== undefined ? asc : prev.sortKey === key ? !prev.sortAsc : true,
    }));
  }, []);

  const toggleSort = useCallback((key: EmployeeColumnKey) => {
    setFilters((prev) => ({
      ...prev,
      sortKey: key,
      sortAsc: prev.sortKey === key ? !prev.sortAsc : true,
    }));
  }, []);

  const toggleColumn = useCallback((col: EmployeeColumnKey) => {
    setFilters((prev) => {
      const exists = prev.visibleColumns.includes(col);
      if (exists && prev.visibleColumns.length <= 1) return prev; // At least one column visible
      const nextCols = exists
        ? prev.visibleColumns.filter((c) => c !== col)
        : [...prev.visibleColumns, col];
      return { ...prev, visibleColumns: nextCols };
    });
  }, []);

  const setVisibleColumns = useCallback((cols: EmployeeColumnKey[]) => {
    const valid = cols.filter((c) => ALL_EMPLOYEE_COLUMNS.includes(c));
    if (valid.length > 0) {
      setFilters((prev) => ({ ...prev, visibleColumns: valid }));
    }
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'All',
      sortKey: 'name',
      sortAsc: true,
      visibleColumns: ALL_EMPLOYEE_COLUMNS,
    });
  }, []);

  return {
    filters,
    debouncedSearch,
    searchQuery: filters.search,
    setSearch,
    setSearchQuery: setSearch,
    statusFilter: filters.status,
    setStatus,
    setStatusFilter: setStatus,
    sortKey: filters.sortKey,
    sortAsc: filters.sortAsc,
    setSort,
    toggleSort,
    handleSort: toggleSort,
    toggleColumn,
    toggleColumnVisibility: toggleColumn,
    visibleColumns: filters.visibleColumns,
    setVisibleColumns,
    resetFilters,
    clearFilters: resetFilters,
  };
}

/**
 * Custom hook for managing filter state with URL synchronization and debouncing.
 *
 * This hook:
 * - Reads initial filter state from URL query parameters
 * - Provides functions to update and reset filters
 * - Debounces filter changes by 300ms to reduce API calls
 * - Syncs filter state to URL for bookmarking and sharing
 * - Calculates the number of active filters for UI display
 *
 * @returns Filter state, debounced filters, update/reset functions, and active filter count
 *
 * @example
 * ```tsx
 * const { filters, debouncedFilters, updateFilter, resetFilters, activeFilterCount } = useFilterState();
 *
 * // Update a single filter
 * updateFilter('status', 'confirmed');
 *
 * // Reset all filters
 * resetFilters();
 *
 * // Use debounced filters for API calls
 * useQuery(['transactions', debouncedFilters], () => fetchTransactions(debouncedFilters));
 * ```
 */
export function useFilterState(): UseFilterStateResult {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL query parameters (only on mount)
  const initialFilters: HistoryFilters = useMemo(() => {
    return {
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      employee: searchParams.get('employee') || '',
      asset: searchParams.get('asset') || '',
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Current filter state (immediate updates)
  const [filters, setFilters] = useState<HistoryFilters>(initialFilters);

  // Debounced filter state (delayed by 300ms)
  const [debouncedFilters, setDebouncedFilters] = useState<HistoryFilters>(initialFilters);

  // Debounce filter changes by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [filters]);

  // Sync debounced filters to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams();

    // Only add non-empty filter values to URL
    if (debouncedFilters.search) params.set('search', debouncedFilters.search);
    if (debouncedFilters.status) params.set('status', debouncedFilters.status);
    if (debouncedFilters.employee) params.set('employee', debouncedFilters.employee);
    if (debouncedFilters.asset) params.set('asset', debouncedFilters.asset);
    if (debouncedFilters.startDate) params.set('startDate', debouncedFilters.startDate);
    if (debouncedFilters.endDate) params.set('endDate', debouncedFilters.endDate);

    // Update URL without triggering navigation
    setSearchParams(params, { replace: true });
  }, [debouncedFilters, setSearchParams]);

  /**
   * Update a single filter value
   *
   * @param key - The filter key to update
   * @param value - The new filter value
   */
  const updateFilter = useCallback((key: keyof HistoryFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  /**
   * Reset all filters to empty values
   */
  const resetFilters = useCallback(() => {
    const emptyFilters: HistoryFilters = {
      search: '',
      status: '',
      employee: '',
      asset: '',
      startDate: '',
      endDate: '',
    };
    setFilters(emptyFilters);
  }, []);

  /**
   * Calculate the number of active (non-empty) filters
   */
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((value) => value !== '').length;
  }, [filters]);

  return {
    filters,
    debouncedFilters,
    updateFilter,
    resetFilters,
    activeFilterCount,
  };
}
