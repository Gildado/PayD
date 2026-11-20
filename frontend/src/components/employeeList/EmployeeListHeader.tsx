import React from 'react';
import { GripVertical, Search, Upload, X } from 'lucide-react';
import type { StatusFilter } from './types';

interface EmployeeListHeaderProps {
  totalEmployees: number;
  activeEmployees: number;
  monthlyPayroll: number;
  searchQuery: string;
  statusFilter: StatusFilter;
  showCSVUploader: boolean;
  reorderMode: boolean;
  setSearchQuery: (value: string) => void;
  setStatusFilter: (value: StatusFilter) => void;
  clearFilters: () => void;
  toggleCSVUploader: () => void;
  toggleReorderMode: () => void;
}

export const EmployeeListHeader: React.FC<EmployeeListHeaderProps> = ({
  totalEmployees,
  activeEmployees,
  monthlyPayroll,
  searchQuery,
  statusFilter,
  showCSVUploader,
  reorderMode,
  setSearchQuery,
  setStatusFilter,
  clearFilters,
  toggleCSVUploader,
  toggleReorderMode,
}) => (
  <div className="border-b border-hi px-5 py-6 sm:px-6">
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
            Employee Directory
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--text)] sm:text-3xl">
            Manage roster, wallets, and payroll readiness from one place.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Search quickly, adjust salaries, copy wallet destinations, and import validated
            roster data without leaving the page.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[25rem]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Total employees
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--text)]">{totalEmployees}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Active
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--accent)]">{activeEmployees}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Payroll base
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--text)]">
              ${monthlyPayroll.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md" htmlFor="employee-search">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            id="employee-search"
            aria-label="Search employees"
            placeholder="Search by name, email, wallet, or role"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-2xl border border-hi bg-[var(--surface-hi)]/70 py-3 pl-11 pr-4 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className="rounded-2xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Clear filters */}
          {(searchQuery || statusFilter !== 'All') && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-hi bg-[var(--surface-hi)] px-3 py-3 text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
              aria-label="Clear filters"
            >
              <X className="h-4 w-4" aria-hidden />
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={toggleCSVUploader}
            className="inline-flex items-center gap-2 rounded-2xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {showCSVUploader ? 'Hide CSV import' : 'Import roster CSV'}
          </button>
          <button
            type="button"
            onClick={toggleReorderMode}
            aria-pressed={reorderMode}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              reorderMode
                ? 'border-[var(--accent)] bg-[color:rgba(74,240,184,0.08)] text-[var(--accent)]'
                : 'border-hi bg-[var(--surface-hi)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
            {reorderMode ? 'Done reordering' : 'Reorder'}
          </button>
        </div>
      </div>
    </div>
  </div>
);
