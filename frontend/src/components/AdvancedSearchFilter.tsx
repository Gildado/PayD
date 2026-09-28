import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X, ChevronDown } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export interface SearchFilters {
  status?: 'All' | 'Active' | 'Inactive';
  department?: string;
  minSalary?: number;
  maxSalary?: number;
  sortBy?: 'name' | 'email' | 'position' | 'salary' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface AdvancedSearchFilterProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  departments?: string[];
}

export const AdvancedSearchFilter: React.FC<AdvancedSearchFilterProps> = ({
  filters,
  onFiltersChange,
  departments = [],
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    },
    []
  );

  const markResultsRefreshing = () => {
    if (prefersReducedMotion) return;
    setIsRefreshing(true);
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 250);
  };
  const reduceMotion = useReducedMotion();

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    markResultsRefreshing();
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    markResultsRefreshing();
    onFiltersChange({
      status: 'All',
      department: undefined,
      minSalary: undefined,
      maxSalary: undefined,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  };

  const hasActiveFilters =
    filters.status !== 'All' ||
    filters.department ||
    filters.minSalary !== undefined ||
    filters.maxSalary !== undefined;

  const transition = reduceMotion
    ? 'motion-reduce:transition-none'
    : 'transition-all duration-(--motion-duration-normal) ease-[var(--motion-ease-out)] motion-reduce:transition-none';
  const transitionFast = reduceMotion
    ? 'motion-reduce:transition-none'
    : 'transition-all duration-(--motion-duration-fast) ease-[var(--motion-ease-out)] motion-reduce:transition-none';

  return (
    <div
      className={`motion-table-refresh rounded-2xl border border-hi bg-[var(--surface-hi)]/70 p-4 ${
        isRefreshing ? 'motion-table-refresh-active' : ''
      } ${prefersReducedMotion ? 'motion-table-refresh-reduced' : ''}`}
    >
    <div className={`rounded-2xl border border-hi bg-[var(--surface-hi)]/70 p-4 ${transition}`}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className={`flex items-center gap-2 rounded-xl text-sm font-semibold text-[var(--text)] outline-none ${transitionFast} hover:text-[var(--accent)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50`}
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
          {hasActiveFilters && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-[var(--bg)]">
              Active
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 ${reduceMotion ? '' : 'transition-transform duration-(--motion-duration-normal) ease-[var(--motion-ease-out)]'} ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className={`inline-flex items-center gap-1.5 rounded-xl border border-hi px-3 py-1.5 text-xs font-semibold text-[var(--muted)] outline-none ${transitionFast} hover:border-[var(--accent)]/50 hover:text-[var(--text)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50`}
          >
            <X className="h-3 w-3" />
            {t('search.resetFilters')}
          </button>
        )}
      </div>

      {isExpanded && (
        <div
          className={`mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 motion-route-in ${transition}`}
        >
          {/* Status Filter */}
          <div>
            <label
              htmlFor="status-filter"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
            >
              {t('search.filterByStatus')}
            </label>
            <select
              id="status-filter"
              value={filters.status || 'All'}
              onChange={(e) =>
                handleFilterChange('status', e.target.value as 'All' | 'Active' | 'Inactive')
              }
              className={`w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none ${transitionFast} focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
            >
              <option value="All">{t('search.allStatuses')}</option>
              <option value="Active">{t('search.active')}</option>
              <option value="Inactive">{t('search.inactive')}</option>
            </select>
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <div>
              <label
                htmlFor="department-filter"
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
              >
                {t('search.filterByDepartment')}
              </label>
              <select
                id="department-filter"
                value={filters.department || ''}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className={`w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none ${transitionFast} focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
              >
                <option value="">{t('search.allDepartments')}</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Min Salary */}
          <div>
            <label
              htmlFor="min-salary"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
            >
              {t('search.minSalary')}
            </label>
            <input
              type="number"
              id="min-salary"
              value={filters.minSalary || ''}
              onChange={(e) =>
                handleFilterChange('minSalary', e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="0"
              className={`w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none ${transitionFast} focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
            />
          </div>

          {/* Max Salary */}
          <div>
            <label
              htmlFor="max-salary"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
            >
              {t('search.maxSalary')}
            </label>
            <input
              type="number"
              id="max-salary"
              value={filters.maxSalary || ''}
              onChange={(e) =>
                handleFilterChange('maxSalary', e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="100000"
              className={`w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none ${transitionFast} focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
            />
          </div>

          {/* Sort By */}
          <div>
            <label
              htmlFor="sort-by"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
            >
              {t('search.sortBy')}
            </label>
            <select
              id="sort-by"
              value={filters.sortBy || 'name'}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className={`w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none ${transitionFast} focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
            >
              <option value="name">{t('employeeList.columnName')}</option>
              <option value="email">{t('employeeProfile.email')}</option>
              <option value="position">{t('employeeList.role')}</option>
              <option value="salary">{t('employeeList.salary')}</option>
              <option value="status">{t('employeeList.columnStatus')}</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label
              htmlFor="sort-order"
              className="mb-2 block text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
            >
              Order
            </label>
            <select
              id="sort-order"
              value={filters.sortOrder || 'asc'}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
              className={`w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none ${transitionFast} focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40`}
            >
              <option value="asc">{t('search.ascending')}</option>
              <option value="desc">{t('search.descending')}</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
