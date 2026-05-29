import React, { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useDebounce } from '../hooks/useDebounce';
import { useNotification } from '../hooks/useNotification';
import { Avatar } from './Avatar';
import { AvatarUpload } from './AvatarUpload';
import { CSVUploader } from './CSVUploader';
import type { CSVRow } from './CSVUploader';
import {
  ArrowUpDown,
  Copy,
  GripVertical,
  Pencil,
  Search,
  Trash2,
  Upload,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { EmployeeRemovalConfirmModal } from './EmployeeRemovalConfirmModal';

export interface Employee {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  position: string;
  wallet?: string;
  salary?: number;
  status?: 'Active' | 'Inactive';
}

interface EmployeeListProps {
  employees: Employee[];
  isLoading?: boolean;
  onEmployeeClick?: (employee: Employee) => void;
  onAddEmployee: (employee: Employee) => void;
  onEditEmployee?: (employee: Employee) => void;
  onRemoveEmployee?: (id: string) => void;
  onUpdateEmployeeImage?: (id: string, imageUrl: string) => void;
}

const SKELETON_ROW_COUNT = 5;

const EmployeeSkeletonRow: React.FC = () => (
  <tr className="animate-pulse border-b border-gray-200/20">
    <td className="p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 shrink-0 rounded-full bg-gray-300/30" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="h-2.5 w-3/4 rounded bg-gray-300/30" />
          <div className="h-2 w-1/2 rounded bg-gray-300/20" />
        </div>
      </div>
    </td>
    <td className="p-6">
      <div className="h-2.5 w-2/3 rounded bg-gray-300/30" />
    </td>
    <td className="p-6">
      <div className="h-2.5 w-3/4 rounded bg-gray-300/20" />
    </td>
    <td className="p-6">
      <div className="h-2.5 w-1/2 rounded bg-gray-300/30" />
    </td>
    <td className="p-6">
      <div className="h-5 w-16 rounded-full bg-gray-300/20" />
    </td>
    <td className="p-6">
      <div className="flex gap-2">
        <div className="h-5 w-5 rounded bg-gray-300/20" />
        <div className="h-5 w-5 rounded bg-gray-300/20" />
      </div>
    </td>
  </tr>
);

const EmployeeSkeletonCard: React.FC = () => (
  <div className="animate-pulse rounded-3xl border border-hi bg-[var(--surface)]/80 p-5">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-full bg-gray-300/30" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-1/2 rounded bg-gray-300/30" />
        <div className="h-2.5 w-2/3 rounded bg-gray-300/20" />
      </div>
    </div>
    <div className="mt-4 grid gap-2">
      <div className="h-2.5 w-full rounded bg-gray-300/20" />
      <div className="h-2.5 w-5/6 rounded bg-gray-300/20" />
      <div className="h-2.5 w-2/5 rounded bg-gray-300/20" />
    </div>
  </div>
);

function shortenWallet(wallet: string) {
  if (!wallet) return 'No wallet assigned';
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
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

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  isLoading = false,
  onEmployeeClick,
  onAddEmployee,
  onEditEmployee,
  onRemoveEmployee,
  onUpdateEmployeeImage,
}) => {
  const { notifySuccess } = useNotification();
  const [csvData, setCsvData] = useState<Employee[]>([]);
  const [showCSVUploader, setShowCSVUploader] = useState(false);
  const [showEditModal, setShowEditModal] = useState<{ open: boolean; employee?: Employee }>({
    open: false,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{
    open: boolean;
    employee?: Employee;
  }>({
    open: false,
  });
  const [showAvatarModal, setShowAvatarModal] = useState<{
    open: boolean;
    employee?: Employee;
  }>({ open: false });
  const [sortKey, setSortKey] = useState<keyof Employee>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [editSalary, setEditSalary] = useState<number>(0);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<Employee[]>([]);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const activeEmployees = employees.filter((employee) => employee.status !== 'Inactive').length;
  const monthlyPayroll = employees.reduce((total, employee) => total + (employee.salary ?? 0), 0);

  const handleDataParsed = (data: CSVRow[]) => {
    const newEmployees = data
      .filter((row) => row.isValid)
      .map((row) => ({
        id: String(Date.now() + Math.random()),
        name: row.data.name,
        email: row.data.email,
        wallet: row.data.wallet,
        position: row.data.position,
        salary: Number(row.data.salary) || 0,
        status: (row.data.status as 'Active' | 'Inactive') || 'Active',
      }));

    setCsvData(newEmployees);
  };

  const handleAddEmployees = () => {
    csvData.forEach((employee) => {
      onAddEmployee(employee);
    });

    notifySuccess(
      `Imported ${csvData.length} employee${csvData.length === 1 ? '' : 's'}`,
      'The directory has been updated with the validated CSV records.'
    );
    setCsvData([]);
    setShowCSVUploader(false);
  };

  const handleSort = (key: keyof Employee) => {
    if (sortKey === key) {
      setSortAsc((current) => !current);
      return;
    }

    setSortKey(key);
    setSortAsc(true);
  };

  const filteredEmployees = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.position.toLowerCase().includes(query) ||
        employee.wallet?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'All' || employee.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [debouncedSearch, employees, statusFilter]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      const valueA = a[sortKey] ?? '';
      const valueB = b[sortKey] ?? '';

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortAsc ? valueA - valueB : valueB - valueA;
      }

      return sortAsc
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });
  }, [filteredEmployees, sortAsc, sortKey]);

  const displayedEmployees = reorderMode ? reorderList : sortedEmployees;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = [...reorderList];
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setReorderList(items);
  };

  const toggleReorderMode = () => {
    if (!reorderMode) setReorderList(sortedEmployees);
    setReorderMode((prev) => !prev);
  };

  const handleDeleteConfirm = (employeeId: string) => {
    if (onRemoveEmployee) {
      onRemoveEmployee(employeeId);
    }
    setShowDeleteConfirm({ open: false });
  };

  const handleEditModalSubmit = () => {
    if (showEditModal.employee && onEditEmployee) {
      onEditEmployee({
        ...showEditModal.employee,
        salary: editSalary,
      });
    }
    setShowEditModal({ open: false });
  };

  const handleCopyWallet = async (employee: Employee) => {
    if (!employee.wallet) return;

    await copyWithFallback(employee.wallet);
    notifySuccess(`${employee.name}'s wallet copied`, shortenWallet(employee.wallet));
  };

  const renderEmptyState = (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center sm:px-12">
      <Users className="h-12 w-12 text-[var(--muted)] opacity-30" aria-hidden />
      <p className="text-base font-semibold text-[var(--text)]">
        {debouncedSearch ? `No employees match "${debouncedSearch}"` : 'No employees found'}
      </p>
      <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
        {debouncedSearch
          ? 'Try a different name, email, wallet, or role keyword.'
          : 'Add employees individually or import a CSV to build your payroll roster.'}
      </p>
    </div>
  );

  const showEmptyState = !isLoading && sortedEmployees.length === 0;

  return (
    <div className="w-full overflow-hidden rounded-[28px] border border-hi bg-[var(--surface)]/95 shadow-[var(--shadow-card)]">
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
                <p className="mt-2 text-2xl font-black text-[var(--text)]">{employees.length}</p>
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
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
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
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('All');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-hi bg-[var(--surface-hi)] px-3 py-3 text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCSVUploader((current) => !current)}
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

      {showCSVUploader ? (
        <div className="border-b border-hi bg-[color:rgba(255,255,255,0.02)] px-5 py-6 sm:px-6">
          <div className="rounded-[24px] border border-[var(--border-hi)] bg-[var(--surface)] p-5 sm:p-6">
            <CSVUploader
              requiredColumns={['name', 'email', 'wallet', 'position', 'salary', 'status']}
              onDataParsed={handleDataParsed}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCSVUploader(false);
                  setCsvData([]);
                }}
                className="rounded-xl border border-hi px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--border-hi)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddEmployees}
                disabled={csvData.length === 0}
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add {csvData.length || 0} employee{csvData.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {!isLoading &&
          (debouncedSearch || statusFilter !== 'All'
            ? `${displayedEmployees.length} employee${displayedEmployees.length === 1 ? '' : 's'} found`
            : '')}
      </div>

      {showEmptyState ? <div className="px-4 py-4 sm:px-6">{renderEmptyState}</div> : null}

      <div className={`px-4 py-4 sm:px-6 lg:hidden ${showEmptyState ? 'hidden' : ''}`}>
        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              <EmployeeSkeletonCard key={index} />
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="employee-cards">
              {(provided) => (
                <div
                  className="grid gap-4"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  aria-label="Employee list — drag to reorder"
                >
                  {displayedEmployees.map((employee, index) => (
                    <Draggable
                      key={employee.id}
                      draggableId={employee.id}
                      index={index}
                      isDragDisabled={!reorderMode}
                    >
                      {(dragProvided, dragSnapshot) => (
                        <article
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          key={employee.id}
                          className={`rounded-3xl border border-hi bg-[var(--surface-hi)]/70 p-5 shadow-[var(--shadow-card)] ${dragSnapshot.isDragging ? 'shadow-[0_8px_32px_rgba(74,240,184,0.15)] ring-1 ring-[var(--accent)]' : ''}`}
                        >
                          {reorderMode && (
                            <div
                              {...dragProvided.dragHandleProps}
                              className="flex items-center justify-center pb-3 cursor-grab active:cursor-grabbing"
                              aria-label={`Drag to reorder ${employee.name}`}
                            >
                              <GripVertical className="h-5 w-5 text-[var(--muted)]" aria-hidden />
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => setShowAvatarModal({ open: true, employee })}
                              className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                              aria-label={`Update photo for ${employee.name}`}
                            >
                              <Avatar
                                email={employee.email}
                                name={employee.name}
                                imageUrl={employee.imageUrl}
                                size="md"
                              />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => onEmployeeClick?.(employee)}
                                  className="min-w-0 text-left"
                                >
                                  <p className="truncate text-base font-bold text-[var(--text)]">
                                    {employee.name}
                                  </p>
                                  <p className="truncate text-sm text-[var(--muted)]">
                                    {employee.email}
                                  </p>
                                </button>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                    employee.status === 'Inactive'
                                      ? 'border-[color:rgba(255,123,114,0.22)] bg-[color:rgba(255,123,114,0.08)] text-[var(--danger)]'
                                      : 'border-[color:rgba(63,185,80,0.22)] bg-[color:rgba(63,185,80,0.08)] text-[var(--success)]'
                                  }`}
                                >
                                  {employee.status || 'Active'}
                                </span>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                                    Role
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                                    {employee.position}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                                    Salary
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                                    ${(employee.salary ?? 0).toLocaleString()} / month
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                                      Wallet
                                    </p>
                                    <code className="mt-1 block truncate text-xs font-medium text-[var(--text)]">
                                      {employee.wallet || 'No wallet assigned'}
                                    </code>
                                  </div>
                                  {employee.wallet ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleCopyWallet(employee)}
                                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-hi text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                      aria-label={`Copy wallet for ${employee.name}`}
                                    >
                                      <Copy className="h-4 w-4" aria-hidden />
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                {onEditEmployee ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditSalary(employee.salary || 0);
                                      setShowEditModal({ open: true, employee });
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl border border-hi px-3 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                  >
                                    <Pencil className="h-4 w-4" aria-hidden />
                                    Edit salary
                                  </button>
                                ) : null}
                                {onRemoveEmployee ? (
                                  <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm({ open: true, employee })}
                                    className="inline-flex items-center gap-2 rounded-xl border border-[color:rgba(255,123,114,0.22)] px-3 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[color:rgba(255,123,114,0.08)]"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </article>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      <div className={`hidden overflow-x-auto lg:block ${showEmptyState ? 'lg:hidden' : ''}`}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-hi">
                {reorderMode && <th className="w-10 p-6" aria-label="Drag handle column" />}
                {[
                  { key: 'name' as const, label: 'Name', width: 'w-[28%]' },
                  { key: 'position' as const, label: 'Role', width: 'w-[18%]' },
                  { key: 'wallet' as const, label: 'Wallet', width: 'w-[18%]' },
                  { key: 'salary' as const, label: 'Salary', width: 'w-[14%]' },
                  { key: 'status' as const, label: 'Status', width: '' },
                ].map((column) => (
                  <th
                    key={column.key}
                    className={`${column.width} p-6`}
                    aria-sort={
                      !reorderMode && sortKey === column.key
                        ? sortAsc
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      disabled={reorderMode}
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--muted)] disabled:cursor-default"
                      onClick={() => !reorderMode && handleSort(column.key)}
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {!reorderMode && <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />}
                      {!reorderMode && sortKey === column.key ? (
                        <span className="text-[var(--accent)]" aria-hidden>
                          {sortAsc ? '▲' : '▼'}
                        </span>
                      ) : null}
                    </button>
                  </th>
                ))}
                <th className="p-6 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <Droppable droppableId="employee-table" direction="vertical">
              {(provided) => (
                <tbody
                  className="divide-y divide-gray-200/5"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {isLoading
                    ? Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                        <EmployeeSkeletonRow key={index} />
                      ))
                    : displayedEmployees.map((employee, index) => (
                        <Draggable
                          key={employee.id}
                          draggableId={`table-${employee.id}`}
                          index={index}
                          isDragDisabled={!reorderMode}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <tr
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`group transition hover:bg-white/5 hover:bg-accent/[0.03] ${dragSnapshot.isDragging ? 'bg-[var(--surface-hi)] shadow-[0_8px_32px_rgba(74,240,184,0.15)]' : ''}`}
                            >
                              {reorderMode && (
                                <td className="p-6 w-10">
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="flex items-center justify-center cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--accent)]"
                                    aria-label={`Drag to reorder ${employee.name}`}
                                  >
                                    <GripVertical className="h-4 w-4" aria-hidden />
                                  </div>
                                </td>
                              )}
                              <td className="p-6">
                                <div className="flex items-center gap-4">
                                  <button
                                    type="button"
                                    onClick={() => setShowAvatarModal({ open: true, employee })}
                                    className="relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                                    aria-label={`Update photo for ${employee.name}`}
                                  >
                                    <Avatar
                                      email={employee.email}
                                      name={employee.name}
                                      imageUrl={employee.imageUrl}
                                      size="md"
                                    />
                                    <span
                                      aria-hidden="true"
                                      className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--bg)] ${
                                        employee.status === 'Inactive'
                                          ? 'bg-[var(--danger)]'
                                          : 'bg-[var(--success)]'
                                      }`}
                                    />
                                  </button>

                                  <div className="min-w-0 flex flex-col">
                                    <button
                                      type="button"
                                      onClick={() => onEmployeeClick?.(employee)}
                                      className="truncate text-left text-sm font-bold text-[var(--text)] transition-colors group-hover:text-[var(--accent)]"
                                      title={employee.name}
                                    >
                                      {employee.name}
                                    </button>
                                    <span
                                      className="truncate text-xs text-[var(--muted)]"
                                      title={employee.email}
                                    >
                                      {employee.email}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="flex flex-col">
                                  <span className="truncate text-sm font-medium text-[var(--text)]">
                                    {employee.position}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                                    Position
                                  </span>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="flex items-center gap-2">
                                  <code className="max-w-[10rem] truncate rounded-lg border border-[var(--border)] bg-[var(--surface-hi)] px-2 py-1 text-[10px] font-mono text-[var(--muted)]">
                                    {employee.wallet ? shortenWallet(employee.wallet) : 'No wallet'}
                                  </code>
                                  {employee.wallet ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleCopyWallet(employee)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                      aria-label={`Copy wallet address for ${employee.name}`}
                                    >
                                      <Copy className="h-4 w-4" aria-hidden />
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="flex flex-col items-start">
                                  {onEditEmployee ? (
                                    <button
                                      type="button"
                                      className="text-sm font-bold text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                                      aria-label={`Edit salary for ${employee.name}: $${(employee.salary ?? 0).toLocaleString()}`}
                                      onClick={() => {
                                        setEditSalary(employee.salary || 0);
                                        setShowEditModal({ open: true, employee });
                                      }}
                                    >
                                      ${(employee.salary ?? 0).toLocaleString()}
                                    </button>
                                  ) : (
                                    <span className="text-sm font-bold text-[var(--text)]">
                                      ${(employee.salary ?? 0).toLocaleString()}
                                    </span>
                                  )}
                                  <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                                    per month
                                  </span>
                                </div>
                              </td>
                              <td className="p-6">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                    employee.status === 'Inactive'
                                      ? 'border-[color:rgba(255,123,114,0.22)] bg-[color:rgba(255,123,114,0.08)] text-[var(--danger)]'
                                      : 'border-[color:rgba(63,185,80,0.22)] bg-[color:rgba(63,185,80,0.08)] text-[var(--success)]'
                                  }`}
                                >
                                  {employee.status || 'Active'}
                                </span>
                              </td>
                              <td className="p-6">
                                <div className="flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                                  {onEditEmployee ? (
                                    <button
                                      type="button"
                                      className="rounded-lg p-2 text-[var(--muted)] transition-all hover:bg-[color:rgba(74,240,184,0.10)] hover:text-[var(--accent)]"
                                      aria-label={`Edit salary for ${employee.name}`}
                                      onClick={() => {
                                        setEditSalary(employee.salary || 0);
                                        setShowEditModal({ open: true, employee });
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" aria-hidden />
                                    </button>
                                  ) : null}
                                  {onRemoveEmployee ? (
                                    <button
                                      type="button"
                                      className="rounded-lg p-2 text-[var(--muted)] transition-all hover:bg-[color:rgba(255,123,114,0.10)] hover:text-[var(--danger)]"
                                      aria-label={`Remove ${employee.name}`}
                                      onClick={() => setShowDeleteConfirm({ open: true, employee })}
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden />
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </table>
        </DragDropContext>
      </div>

      {showEditModal.open && showEditModal.employee ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-salary-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-3xl border border-hi bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Salary adjustment
            </p>
            <h3 id="edit-salary-title" className="mt-2 text-xl font-black text-[var(--text)]">
              Update {showEditModal.employee.name}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{showEditModal.employee.position}</p>

            <label
              className="mt-6 block text-sm font-semibold text-[var(--text)]"
              htmlFor="edit-salary"
            >
              Monthly salary
            </label>
            <input
              id="edit-salary"
              type="number"
              value={editSalary}
              autoFocus
              onChange={(event) => setEditSalary(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal({ open: false })}
                className="rounded-xl border border-hi px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditModalSubmit}
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition hover:brightness-110"
              >
                Save salary
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <EmployeeRemovalConfirmModal
        isOpen={showDeleteConfirm.open}
        employeeName={showDeleteConfirm.employee?.name || ''}
        employeeId={showDeleteConfirm.employee?.id || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm({ open: false })}
      />

      {showAvatarModal.open && showAvatarModal.employee ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl border border-hi bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
                <UserCircle2 className="h-5 w-5 text-[var(--accent)]" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Directory photo
                </p>
                <h3 id="avatar-modal-title" className="mt-1 text-xl font-black text-[var(--text)]">
                  Update employee photo
                </h3>
              </div>
            </div>

            <div className="mt-5">
              <AvatarUpload
                email={showAvatarModal.employee.email}
                name={showAvatarModal.employee.name}
                currentImageUrl={showAvatarModal.employee.imageUrl}
                label="Upload Employee Photo"
                onImageUpload={(imageUrl) => {
                  if (onUpdateEmployeeImage) {
                    onUpdateEmployeeImage(showAvatarModal.employee!.id, imageUrl);
                  } else if (onEditEmployee) {
                    onEditEmployee({ ...showAvatarModal.employee!, imageUrl });
                  }
                  setShowAvatarModal({ open: false });
                }}
              />
            </div>

            <button
              type="button"
              className="mt-5 w-full rounded-xl border border-hi px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
              onClick={() => setShowAvatarModal({ open: false })}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
