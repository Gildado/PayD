import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { HistoryFilters, UseFilterStateResult } from '../types/transactionHistory';

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
