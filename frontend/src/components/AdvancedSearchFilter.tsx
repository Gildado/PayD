import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

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

  const handleFilterChange = (key: keyof SearchFilters, value: string | number) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
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

  return (
    <div className="rounded-2xl border border-hi bg-[var(--surface-hi)]/70 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text)] transition hover:text-[var(--accent)]"
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
          {hasActiveFilters && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-[var(--bg)]">
              Active
            </span>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-hi px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            <X className="h-3 w-3" />
            {t('search.resetFilters')}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              className="w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
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
                className="w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
              >
                <option value="">All Departments</option>
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
              className="w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
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
              className="w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
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
              className="w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="position">Position</option>
              <option value="salary">Salary</option>
              <option value="status">Status</option>
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
              className="w-full rounded-xl border border-hi bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
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
