import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { List, useListRef } from 'react-window';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDebounce } from '../hooks/useDebounce';
import { useNotification } from '../hooks/useNotification';
import { Avatar } from './Avatar';
import { AvatarUpload } from './AvatarUpload';
import { CSVUploader } from './CSVUploader';
import type { CSVRow } from './CSVUploader';
import {
  ArrowUpDown,
  Check,
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
  <tr className="animate-pulse motion-reduce:animate-none border-b border-hi/40">
    <td className="p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 shrink-0 rounded-full bg-hi/60" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="h-2.5 w-3/4 rounded bg-hi/60" />
          <div className="h-2 w-1/2 rounded bg-hi/40" />
        </div>
      </div>
    </td>
    <td className="p-6">
      <div className="h-2.5 w-2/3 rounded bg-hi/60" />
    </td>
    <td className="p-6">
      <div className="h-2.5 w-3/4 rounded bg-hi/40" />
    </td>
    <td className="p-6">
      <div className="h-2.5 w-1/2 rounded bg-hi/60" />
    </td>
    <td className="p-6">
      <div className="h-5 w-16 rounded-full bg-hi/40" />
    </td>
    <td className="p-6">
      <div className="flex gap-2">
        <div className="h-5 w-5 rounded bg-hi/40" />
        <div className="h-5 w-5 rounded bg-hi/40" />
      </div>
    </td>
  </tr>
);

const EmployeeSkeletonCard: React.FC = () => (
  <div className="animate-pulse motion-reduce:animate-none rounded-3xl border border-hi bg-[var(--surface)]/80 p-5">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-full bg-hi/60" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-1/2 rounded bg-hi/60" />
        <div className="h-2.5 w-2/3 rounded bg-hi/40" />
      </div>
    </div>
    <div className="mt-4 grid gap-2">
      <div className="h-2.5 w-full rounded bg-hi/40" />
      <div className="h-2.5 w-5/6 rounded bg-hi/40" />
      <div className="h-2.5 w-2/5 rounded bg-hi/40" />
    </div>
  </div>
);

function shortenWallet(wallet: string, noWalletLabel: string) {
  if (!wallet) return noWalletLabel;
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

// ---------------------------------------------------------------------------
// Virtualization
// ---------------------------------------------------------------------------

/** Row height (px) for the virtualized desktop table — matches the padding
 * and content height of the previous native <tr>/<td> layout. */
const TABLE_ROW_HEIGHT = 88;
/** Row height (px) for the virtualized mobile card list. */
const CARD_ROW_HEIGHT = 328;
/** Height of the scrollable virtualization viewport. Responsive: caps out on
 * large screens, shrinks on small ones, but never collapses to unusable size. */
const LIST_VIEWPORT_CLASS = 'h-[min(70vh,640px)] min-h-[280px]';
/** Matches the previous table's column width ratios (28/18/18/14/rest) plus a
 * fixed-width actions column. */
const TABLE_GRID_TEMPLATE = '28% 18% 18% 14% 1fr 96px';

/**
 * Roving-tabindex keyboard navigation for a virtualized react-window list.
 * Arrow keys move focus by one row, Home/End jump to the ends, and
 * PageUp/PageDown move by a full viewport of rows (derived from the range
 * react-window last reported as rendered).
 */
function useVirtualizedRowNavigation(rowCount: number) {
  const listRef = useListRef(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [viewportRowCount, setViewportRowCount] = useState(1);
  const rowElementsRef = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    setFocusedIndex((prev) => Math.min(prev, Math.max(rowCount - 1, 0)));
  }, [rowCount]);

  const handleRowsRendered = useCallback((visible: { startIndex: number; stopIndex: number }) => {
    setViewportRowCount(Math.max(visible.stopIndex - visible.startIndex + 1, 1));
  }, []);

  const registerRowElement = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      rowElementsRef.current.set(index, el);
    } else {
      rowElementsRef.current.delete(index);
    }
  }, []);

  const focusRow = useCallback(
    (index: number) => {
      setFocusedIndex(index);
      listRef.current?.scrollToRow({ index, align: 'auto' });
      requestAnimationFrame(() => {
        rowElementsRef.current.get(index)?.focus();
      });
    },
    [listRef]
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;
      switch (event.key) {
        case 'ArrowDown':
          nextIndex = Math.min(index + 1, rowCount - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(index - 1, 0);
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = rowCount - 1;
          break;
        case 'PageDown':
          nextIndex = Math.min(index + viewportRowCount, rowCount - 1);
          break;
        case 'PageUp':
          nextIndex = Math.max(index - viewportRowCount, 0);
          break;
        default:
          return;
      }
      event.preventDefault();
      focusRow(nextIndex);
    },
    [rowCount, viewportRowCount, focusRow]
  );

  return { listRef, focusedIndex, handleRowKeyDown, handleRowsRendered, registerRowElement };
}

interface EmployeeRowSharedProps {
  employees: Employee[];
  focusedIndex: number;
  onRowKeyDown: (event: React.KeyboardEvent, index: number) => void;
  registerRowElement: (index: number, el: HTMLElement | null) => void;
  onEmployeeClick?: (employee: Employee) => void;
  onAvatarClick: (employee: Employee) => void;
  onEditClick?: (employee: Employee) => void;
  onDeleteClick?: (employee: Employee) => void;
  onCopyWallet: (employee: Employee) => void;
  copiedId: string | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  language: string;
}

/** A single row of the virtualized desktop table (ARIA grid semantics via divs,
 * since react-window positions rows absolutely — incompatible with native
 * <table> layout, which requires all rows to participate in normal flow). */
const VirtualizedEmployeeTableRow: React.FC<
  {
    index: number;
    style: React.CSSProperties;
    ariaAttributes: Record<string, unknown>;
  } & EmployeeRowSharedProps
> = ({
  index,
  style,
  ariaAttributes,
  employees,
  focusedIndex,
  onRowKeyDown,
  registerRowElement,
  onEmployeeClick,
  onAvatarClick,
  onEditClick,
  onDeleteClick,
  onCopyWallet,
  copiedId,
  t,
  language,
}) => {
  const employee = employees[index];
  if (!employee) return null;

  return (
    <div
      {...ariaAttributes}
      role="row"
      data-testid="employee-table-row"
      ref={(el) => registerRowElement(index, el)}
      tabIndex={focusedIndex === index ? 0 : -1}
      onKeyDown={(event) => onRowKeyDown(event, index)}
      style={{ ...style, display: 'grid', gridTemplateColumns: TABLE_GRID_TEMPLATE }}
      className="group items-center gap-4 border-b border-hi/40 px-6 transition-colors duration-150 motion-reduce:transition-none hover:bg-accent/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
    >
      <div role="cell" className="flex items-center gap-4 overflow-hidden pr-2">
        <button
          type="button"
          onClick={() => onAvatarClick(employee)}
          className="relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
          aria-label={t('employeeList.updatePhotoFor', { name: employee.name })}
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
              employee.status === 'Inactive' ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'
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
          <span className="truncate text-xs text-[var(--muted)]" title={employee.email}>
            {employee.email}
          </span>
        </div>
      </div>

      <div role="cell" className="flex flex-col overflow-hidden pr-2">
        <span className="truncate text-sm font-medium text-[var(--text)]">{employee.position}</span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {t('employeeList.role')}
        </span>
      </div>

      <div role="cell" className="flex items-center gap-2 overflow-hidden pr-2">
        <code className="max-w-[10rem] truncate rounded-lg border border-[var(--border)] bg-[var(--surface-hi)] px-2 py-1 text-[10px] font-mono text-[var(--muted)]">
          {employee.wallet
            ? shortenWallet(employee.wallet, t('employeeList.noWalletAssigned'))
            : t('employeeList.noWallet')}
        </code>
        {employee.wallet ? (
          <button
            type="button"
            onClick={() => onCopyWallet(employee)}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition duration-150 motion-reduce:transition-none ${
              copiedId === employee.id
                ? 'border-[var(--success)] text-[var(--success)]'
                : 'border-transparent text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
            aria-label={t('employeeList.copyWalletAddressFor', { name: employee.name })}
          >
            {copiedId === employee.id ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      <div role="cell" className="flex flex-col items-start overflow-hidden pr-2">
        {onEditClick ? (
          <button
            type="button"
            className="text-sm font-bold text-[var(--text)] transition-colors hover:text-[var(--accent)]"
            aria-label={t('employeeList.editSalaryForWithAmount', {
              name: employee.name,
              amount: (employee.salary ?? 0).toLocaleString(language),
            })}
            onClick={() => onEditClick(employee)}
          >
            ${(employee.salary ?? 0).toLocaleString(language)}
          </button>
        ) : (
          <span className="text-sm font-bold text-[var(--text)]">
            ${(employee.salary ?? 0).toLocaleString(language)}
          </span>
        )}
        <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {t('employeeList.perMonth')}
        </span>
      </div>

      <div role="cell" className="flex items-center overflow-hidden pr-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
            employee.status === 'Inactive'
              ? 'border-danger/[0.22] bg-danger/[0.08] text-[var(--danger)]'
              : 'border-success/[0.22] bg-success/[0.08] text-[var(--success)]'
          }`}
        >
          {employee.status
            ? employee.status === 'Active'
              ? t('employeeList.active')
              : t('employeeList.inactive')
            : t('employeeList.active')}
        </span>
      </div>

      <div role="cell" className="flex items-center gap-1">
        {onEditClick ? (
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted)] transition-all duration-150 motion-reduce:transition-none hover:bg-accent/[0.10] hover:text-[var(--accent)]"
            aria-label={t('employeeList.editSalaryFor', { name: employee.name })}
            onClick={() => onEditClick(employee)}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        {onDeleteClick ? (
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted)] transition-all duration-150 motion-reduce:transition-none hover:bg-danger/[0.10] hover:text-[var(--danger)]"
            aria-label={t('employeeList.removeEmployee', { name: employee.name })}
            onClick={() => onDeleteClick(employee)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
};

/** A single card of the virtualized mobile list. */
const VirtualizedEmployeeCard: React.FC<
  {
    index: number;
    style: React.CSSProperties;
    ariaAttributes: Record<string, unknown>;
  } & EmployeeRowSharedProps
> = ({
  index,
  style,
  ariaAttributes,
  employees,
  focusedIndex,
  onRowKeyDown,
  registerRowElement,
  onEmployeeClick,
  onAvatarClick,
  onEditClick,
  onDeleteClick,
  onCopyWallet,
  copiedId,
  t,
  language,
}) => {
  const employee = employees[index];
  if (!employee) return null;

  return (
    <div style={{ ...style, padding: '0.5rem 0' }}>
      <article
        {...ariaAttributes}
        data-testid="employee-card-row"
        ref={(el) => registerRowElement(index, el)}
        tabIndex={focusedIndex === index ? 0 : -1}
        onKeyDown={(event) => onRowKeyDown(event, index)}
        className="h-full rounded-3xl border border-hi bg-[var(--surface-hi)]/70 p-5 shadow-[var(--shadow-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onAvatarClick(employee)}
            className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            aria-label={t('employeeList.updatePhotoFor', { name: employee.name })}
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
                <p className="truncate text-base font-bold text-[var(--text)]">{employee.name}</p>
                <p className="truncate text-sm text-[var(--muted)]">{employee.email}</p>
              </button>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                  employee.status === 'Inactive'
                    ? 'border-danger/[0.22] bg-danger/[0.08] text-[var(--danger)]'
                    : 'border-success/[0.22] bg-success/[0.08] text-[var(--success)]'
                }`}
              >
                {employee.status
                  ? employee.status === 'Active'
                    ? t('employeeList.active')
                    : t('employeeList.inactive')
                  : t('employeeList.active')}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  {t('employeeList.role')}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text)]">{employee.position}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  {t('employeeList.salary')}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                  {t('employeeList.salaryPerMonth', {
                    amount: (employee.salary ?? 0).toLocaleString(language),
                  })}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                    {t('employeeList.wallet')}
                  </p>
                  <code className="mt-1 block truncate text-xs font-medium text-[var(--text)]">
                    {employee.wallet || t('employeeList.noWalletAssigned')}
                  </code>
                </div>
                {employee.wallet ? (
                  <button
                    type="button"
                    onClick={() => onCopyWallet(employee)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition duration-150 motion-reduce:transition-none ${
                      copiedId === employee.id
                        ? 'border-[var(--success)] text-[var(--success)]'
                        : 'border-hi text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    }`}
                    aria-label={t('employeeList.copyWalletFor', { name: employee.name })}
                  >
                    {copiedId === employee.id ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {onEditClick ? (
                <button
                  type="button"
                  onClick={() => onEditClick(employee)}
                  className="inline-flex items-center gap-2 rounded-xl border border-hi px-3 py-2 text-sm font-semibold text-[var(--text)] transition duration-150 motion-reduce:transition-none hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  {t('employeeList.editSalary')}
                </button>
              ) : null}
              {onDeleteClick ? (
                <button
                  type="button"
                  onClick={() => onDeleteClick(employee)}
                  className="inline-flex items-center gap-2 rounded-xl border border-danger/[0.22] px-3 py-2 text-sm font-semibold text-[var(--danger)] transition duration-150 motion-reduce:transition-none hover:bg-danger/[0.08]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t('employeeList.remove')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  isLoading = false,
  onEmployeeClick,
  onAddEmployee,
  onEditEmployee,
  onRemoveEmployee,
  onUpdateEmployeeImage,
}) => {
  const { t, i18n } = useTranslation();
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const prefersReducedMotion = useReducedMotion();
  const transitionDuration = prefersReducedMotion ? 0 : 0.2;

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
      t('employeeList.importedCount', { count: csvData.length }),
      t('employeeList.directoryUpdated')
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
    notifySuccess(
      t('employeeList.walletCopied', { name: employee.name }),
      shortenWallet(employee.wallet, t('employeeList.noWalletAssigned'))
    );
    setCopiedId(employee.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderEmptyState = (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center sm:px-12">
      <Users className="h-12 w-12 text-[var(--muted)] opacity-30" aria-hidden />
      <p className="text-base font-semibold text-[var(--text)]">
        {debouncedSearch
          ? t('employeeList.noEmployeesMatch', { query: debouncedSearch })
          : t('employeeList.noEmployeesFound')}
      </p>
      <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
        {debouncedSearch
          ? t('employeeList.tryDifferentKeyword')
          : t('employeeList.addEmployeesHint')}
      </p>
    </div>
  );

  const showEmptyState = !isLoading && sortedEmployees.length === 0;

  // Virtualized (non-reorder) rendering: keyboard navigation + shared row props.
  const tableNav = useVirtualizedRowNavigation(displayedEmployees.length);
  const cardNav = useVirtualizedRowNavigation(displayedEmployees.length);

  const handleAvatarClick = useCallback((employee: Employee) => {
    setShowAvatarModal({ open: true, employee });
  }, []);

  const handleEditClick = onEditEmployee
    ? (employee: Employee) => {
        setEditSalary(employee.salary || 0);
        setShowEditModal({ open: true, employee });
      }
    : undefined;

  const handleDeleteClick = onRemoveEmployee
    ? (employee: Employee) => {
        setShowDeleteConfirm({ open: true, employee });
      }
    : undefined;

  const rowSharedProps: EmployeeRowSharedProps = {
    employees: displayedEmployees,
    focusedIndex: tableNav.focusedIndex,
    onRowKeyDown: tableNav.handleRowKeyDown,
    registerRowElement: tableNav.registerRowElement,
    onEmployeeClick,
    onAvatarClick: handleAvatarClick,
    onEditClick: handleEditClick,
    onDeleteClick: handleDeleteClick,
    onCopyWallet: (employee) => {
      void handleCopyWallet(employee);
    },
    copiedId,
    t,
    language: i18n.language,
  };

  const cardSharedProps: EmployeeRowSharedProps = {
    ...rowSharedProps,
    focusedIndex: cardNav.focusedIndex,
    onRowKeyDown: cardNav.handleRowKeyDown,
    registerRowElement: cardNav.registerRowElement,
  };

  return (
    <div className="w-full overflow-hidden rounded-[28px] border border-hi bg-[var(--surface)]/95 shadow-[var(--shadow-card)]">
      <div className="border-b border-hi px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                {t('employeeList.employeeDirectory')}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--text)] sm:text-3xl">
                {t('employeeList.heroHeading')}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                {t('employeeList.heroDescription')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[25rem]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  {t('employeeList.totalEmployees')}
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--text)]">{employees.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  {t('employeeList.active')}
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--accent)]">{activeEmployees}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  {t('employeeList.payrollBase')}
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--text)]">
                  ${monthlyPayroll.toLocaleString(i18n.language)}
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
                aria-label={t('employeeList.searchEmployees')}
                placeholder={t('employeeList.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-hi bg-[var(--surface-hi)]/70 py-3 pl-11 pr-4 text-sm text-[var(--text)] outline-none transition duration-150 motion-reduce:transition-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-accent/[0.18]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
                aria-label={t('employeeList.filterByStatus')}
                className="rounded-2xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition duration-150 motion-reduce:transition-none focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-accent/[0.18]"
              >
                <option value="All">{t('employeeList.allStatuses')}</option>
                <option value="Active">{t('employeeList.active')}</option>
                <option value="Inactive">{t('employeeList.inactive')}</option>
              </select>

              {/* Clear filters */}
              {(searchQuery || statusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('All');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-hi bg-[var(--surface-hi)] px-3 py-3 text-sm text-[var(--muted)] transition duration-150 motion-reduce:transition-none hover:text-[var(--text)]"
                  aria-label={t('employeeList.clearFilters')}
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t('employeeList.clear')}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCSVUploader((current) => !current)}
                className="inline-flex items-center gap-2 rounded-2xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition duration-150 motion-reduce:transition-none hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {showCSVUploader
                  ? t('employeeList.hideCsvImport')
                  : t('employeeList.importRosterCsv')}
              </button>
              <button
                type="button"
                onClick={toggleReorderMode}
                aria-pressed={reorderMode}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none ${
                  reorderMode
                    ? 'border-[var(--accent)] bg-accent/[0.08] text-[var(--accent)]'
                    : 'border-hi bg-[var(--surface-hi)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
              >
                <GripVertical className="h-4 w-4" aria-hidden />
                {reorderMode ? t('employeeList.doneReordering') : t('employeeList.reorder')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showCSVUploader ? (
          <motion.div
            key="csv-uploader-panel"
            initial={{ height: prefersReducedMotion ? 'auto' : 0, opacity: prefersReducedMotion ? 1 : 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: prefersReducedMotion ? 'auto' : 0, opacity: prefersReducedMotion ? 1 : 0 }}
            transition={{ duration: transitionDuration, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-b border-hi bg-[var(--surface-hi)]/30"
          >
            <div className="px-5 py-6 sm:px-6">
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
                    className="rounded-xl border border-hi px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--border-hi)] hover:text-[var(--text)]"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEmployees}
                    disabled={csvData.length === 0}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition-all duration-150 motion-reduce:transition-none hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('employeeList.addEmployeesCount', { count: csvData.length || 0 })}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {!isLoading &&
          (debouncedSearch || statusFilter !== 'All'
            ? t('employeeList.employeesFoundCount', { count: displayedEmployees.length })
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
        ) : reorderMode ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="employee-cards">
              {(provided) => (
                <div
                  className="grid gap-4"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  aria-label={t('employeeList.dragToReorderAriaLabel')}
                >
                  {displayedEmployees.map((employee, index) => (
                    <Draggable key={employee.id} draggableId={employee.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <article
                          key={employee.id}
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`rounded-3xl border border-hi bg-[var(--surface-hi)]/70 p-5 shadow-[var(--shadow-card)] transition-shadow duration-150 motion-reduce:transition-none ${dragSnapshot.isDragging ? 'shadow-[0_8px_32px_color-mix(in_srgb,var(--accent)_15%,transparent)] ring-1 ring-[var(--accent)]' : ''}`}
                        >
                          <div
                            {...dragProvided.dragHandleProps}
                            className="flex items-center justify-center pb-3 cursor-grab active:cursor-grabbing"
                            aria-label={t('employeeList.dragToReorderEmployee', {
                              name: employee.name,
                            })}
                          >
                            <GripVertical className="h-5 w-5 text-[var(--muted)]" aria-hidden />
                          </div>
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => setShowAvatarModal({ open: true, employee })}
                              className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                              aria-label={t('employeeList.updatePhotoFor', { name: employee.name })}
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
                                      ? 'border-danger/[0.22] bg-danger/[0.08] text-[var(--danger)]'
                                      : 'border-success/[0.22] bg-success/[0.08] text-[var(--success)]'
                                  }`}
                                >
                                  {employee.status
                                    ? employee.status === 'Active'
                                      ? t('employeeList.active')
                                      : t('employeeList.inactive')
                                    : t('employeeList.active')}
                                </span>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                                    {t('employeeList.role')}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                                    {employee.position}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                                    {t('employeeList.salary')}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                                    {t('employeeList.salaryPerMonth', {
                                      amount: (employee.salary ?? 0).toLocaleString(i18n.language),
                                    })}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                                      {t('employeeList.wallet')}
                                    </p>
                                    <code className="mt-1 block truncate text-xs font-medium text-[var(--text)]">
                                      {employee.wallet || t('employeeList.noWalletAssigned')}
                                    </code>
                                  </div>
                                  {employee.wallet ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleCopyWallet(employee)}
                                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition duration-150 motion-reduce:transition-none ${
                                        copiedId === employee.id
                                          ? 'border-[var(--success)] text-[var(--success)]'
                                          : 'border-hi text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                                      }`}
                                      aria-label={t('employeeList.copyWalletFor', {
                                        name: employee.name,
                                      })}
                                    >
                                      {copiedId === employee.id ? (
                                        <Check className="h-4 w-4" aria-hidden />
                                      ) : (
                                        <Copy className="h-4 w-4" aria-hidden />
                                      )}
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
                                    className="inline-flex items-center gap-2 rounded-xl border border-hi px-3 py-2 text-sm font-semibold text-[var(--text)] transition duration-150 motion-reduce:transition-none hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                  >
                                    <Pencil className="h-4 w-4" aria-hidden />
                                    {t('employeeList.editSalary')}
                                  </button>
                                ) : null}
                                {onRemoveEmployee ? (
                                  <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm({ open: true, employee })}
                                    className="inline-flex items-center gap-2 rounded-xl border border-danger/[0.22] px-3 py-2 text-sm font-semibold text-[var(--danger)] transition duration-150 motion-reduce:transition-none hover:bg-danger/[0.08]"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                    {t('employeeList.remove')}
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
        ) : (
          <div
            className={LIST_VIEWPORT_CLASS}
            role="list"
            aria-label={t('employeeList.employeeDirectory')}
          >
            <List
              listRef={cardNav.listRef}
              rowComponent={VirtualizedEmployeeCard}
              rowCount={displayedEmployees.length}
              rowHeight={CARD_ROW_HEIGHT}
              rowProps={cardSharedProps}
              onRowsRendered={cardNav.handleRowsRendered}
              overscanCount={5}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        )}
      </div>

      <div className={`hidden overflow-x-auto lg:block ${showEmptyState ? 'lg:hidden' : ''}`}>
        {isLoading || reorderMode ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-hi">
                  {reorderMode && (
                    <th className="w-10 p-6" aria-label={t('employeeList.dragHandleColumn')} />
                  )}
                  {[
                    { key: 'name' as const, label: t('employeeList.columnName'), width: 'w-[28%]' },
                    {
                      key: 'position' as const,
                      label: t('employeeList.role'),
                      width: 'w-[18%]',
                    },
                    { key: 'wallet' as const, label: t('employeeList.wallet'), width: 'w-[18%]' },
                    { key: 'salary' as const, label: t('employeeList.salary'), width: 'w-[14%]' },
                    { key: 'status' as const, label: t('employeeList.columnStatus'), width: '' },
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
                        aria-label={t('employeeList.sortByColumn', { column: column.label })}
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
                    {t('bulkPaymentTracker.columnActions')}
                  </th>
                </tr>
              </thead>
              <Droppable droppableId="employee-table" direction="vertical">
                {(provided) => (
                  <tbody
                    className="divide-y divide-hi/60"
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
                                className={`group transition-colors duration-150 motion-reduce:transition-none hover:bg-accent/[0.03] ${dragSnapshot.isDragging ? 'bg-[var(--surface-hi)] shadow-[0_8px_32px_color-mix(in_srgb,var(--accent)_15%,transparent)]' : ''}`}
                              >
                                {reorderMode && (
                                  <td className="p-6 w-10">
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="flex items-center justify-center cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--accent)]"
                                      aria-label={t('employeeList.dragToReorderEmployee', {
                                        name: employee.name,
                                      })}
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
                                      aria-label={t('employeeList.updatePhotoFor', {
                                        name: employee.name,
                                      })}
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
                                      {t('employeeList.role')}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-6">
                                  <div className="flex items-center gap-2">
                                    <code className="max-w-[10rem] truncate rounded-lg border border-[var(--border)] bg-[var(--surface-hi)] px-2 py-1 text-[10px] font-mono text-[var(--muted)]">
                                      {employee.wallet
                                        ? shortenWallet(
                                            employee.wallet,
                                            t('employeeList.noWalletAssigned')
                                          )
                                        : t('employeeList.noWallet')}
                                    </code>
                                    {employee.wallet ? (
                                      <button
                                        type="button"
                                        onClick={() => void handleCopyWallet(employee)}
                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition duration-150 motion-reduce:transition-none ${
                                          copiedId === employee.id
                                            ? 'border-[var(--success)] text-[var(--success)]'
                                            : 'border-transparent text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                                        }`}
                                        aria-label={t('employeeList.copyWalletAddressFor', {
                                          name: employee.name,
                                        })}
                                      >
                                        {copiedId === employee.id ? (
                                          <Check className="h-4 w-4" aria-hidden />
                                        ) : (
                                          <Copy className="h-4 w-4" aria-hidden />
                                        )}
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
                                        aria-label={t('employeeList.editSalaryForWithAmount', {
                                          name: employee.name,
                                          amount: (employee.salary ?? 0).toLocaleString(
                                            i18n.language
                                          ),
                                        })}
                                        onClick={() => {
                                          setEditSalary(employee.salary || 0);
                                          setShowEditModal({ open: true, employee });
                                        }}
                                      >
                                        ${(employee.salary ?? 0).toLocaleString(i18n.language)}
                                      </button>
                                    ) : (
                                      <span className="text-sm font-bold text-[var(--text)]">
                                        ${(employee.salary ?? 0).toLocaleString(i18n.language)}
                                      </span>
                                    )}
                                    <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                                      {t('employeeList.perMonth')}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-6">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                                      employee.status === 'Inactive'
                                        ? 'border-danger/[0.22] bg-danger/[0.08] text-[var(--danger)]'
                                        : 'border-success/[0.22] bg-success/[0.08] text-[var(--success)]'
                                    }`}
                                  >
                                    {employee.status
                                      ? employee.status === 'Active'
                                        ? t('employeeList.active')
                                        : t('employeeList.inactive')
                                      : t('employeeList.active')}
                                  </span>
                                </td>
                                <td className="p-6">
                                  <div className="flex items-center gap-1 opacity-100 transition-opacity duration-150 motion-reduce:transition-none lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                                    {onEditEmployee ? (
                                      <button
                                        type="button"
                                        className="rounded-lg p-2 text-[var(--muted)] transition-all duration-150 motion-reduce:transition-none hover:bg-accent/[0.10] hover:text-[var(--accent)]"
                                        aria-label={t('employeeList.editSalaryFor', {
                                          name: employee.name,
                                        })}
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
                                        className="rounded-lg p-2 text-[var(--muted)] transition-all duration-150 motion-reduce:transition-none hover:bg-danger/[0.10] hover:text-[var(--danger)]"
                                        aria-label={t('employeeList.removeEmployee', {
                                          name: employee.name,
                                        })}
                                        onClick={() =>
                                          setShowDeleteConfirm({ open: true, employee })
                                        }
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
        ) : (
          <div role="table" aria-label={t('employeeList.employeeDirectory')}>
            <div role="rowgroup">
              <div
                role="row"
                style={{ display: 'grid', gridTemplateColumns: TABLE_GRID_TEMPLATE }}
                className="border-b border-hi"
              >
                {[
                  { key: 'name' as const, label: t('employeeList.columnName') },
                  { key: 'position' as const, label: t('employeeList.role') },
                  { key: 'wallet' as const, label: t('employeeList.wallet') },
                  { key: 'salary' as const, label: t('employeeList.salary') },
                  { key: 'status' as const, label: t('employeeList.columnStatus') },
                ].map((column) => (
                  <div
                    key={column.key}
                    role="columnheader"
                    className="p-6"
                    aria-sort={
                      sortKey === column.key ? (sortAsc ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
                      onClick={() => handleSort(column.key)}
                      aria-label={t('employeeList.sortByColumn', { column: column.label })}
                    >
                      {column.label}
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
                      {sortKey === column.key ? (
                        <span className="text-[var(--accent)]" aria-hidden>
                          {sortAsc ? '▲' : '▼'}
                        </span>
                      ) : null}
                    </button>
                  </div>
                ))}
                <div
                  role="columnheader"
                  className="p-6 text-xs font-bold uppercase tracking-widest text-[var(--muted)]"
                >
                  {t('bulkPaymentTracker.columnActions')}
                </div>
              </div>
            </div>

            <div className={LIST_VIEWPORT_CLASS} role="rowgroup">
              <List
                listRef={tableNav.listRef}
                rowComponent={VirtualizedEmployeeTableRow}
                rowCount={displayedEmployees.length}
                rowHeight={TABLE_ROW_HEIGHT}
                rowProps={rowSharedProps}
                onRowsRendered={tableNav.handleRowsRendered}
                overscanCount={5}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEditModal.open && showEditModal.employee ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-salary-title"
            initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: prefersReducedMotion ? 1 : 0 }}
            transition={{ duration: transitionDuration }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ opacity: prefersReducedMotion ? 1 : 0, scale: prefersReducedMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: prefersReducedMotion ? 1 : 0, scale: prefersReducedMotion ? 1 : 0.96 }}
              transition={{ duration: transitionDuration, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-md rounded-3xl border border-hi bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                {t('employeeList.salaryAdjustment')}
              </p>
              <h3 id="edit-salary-title" className="mt-2 text-xl font-black text-[var(--text)]">
                {t('employeeList.updateEmployee', { name: showEditModal.employee.name })}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{showEditModal.employee.position}</p>

              <label
                className="mt-6 block text-sm font-semibold text-[var(--text)]"
                htmlFor="edit-salary"
              >
                {t('employeeList.monthlySalary')}
              </label>
              <input
                id="edit-salary"
                type="number"
                value={editSalary}
                autoFocus
                onChange={(event) => setEditSalary(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-accent/[0.18]"
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal({ open: false })}
                  className="rounded-xl border border-hi px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition duration-150 motion-reduce:transition-none hover:text-[var(--text)]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleEditModalSubmit}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition duration-150 motion-reduce:transition-none hover:brightness-110"
                >
                  {t('employeeList.saveSalary')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <EmployeeRemovalConfirmModal
        isOpen={showDeleteConfirm.open}
        employeeName={showDeleteConfirm.employee?.name || ''}
        employeeId={showDeleteConfirm.employee?.id || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm({ open: false })}
      />

      <AnimatePresence>
        {showAvatarModal.open && showAvatarModal.employee ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-modal-title"
            initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: prefersReducedMotion ? 1 : 0 }}
            transition={{ duration: transitionDuration }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ opacity: prefersReducedMotion ? 1 : 0, scale: prefersReducedMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: prefersReducedMotion ? 1 : 0, scale: prefersReducedMotion ? 1 : 0.96 }}
              transition={{ duration: transitionDuration, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-sm rounded-3xl border border-hi bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
                  <UserCircle2 className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                    {t('employeeList.directoryPhoto')}
                  </p>
                  <h3 id="avatar-modal-title" className="mt-1 text-xl font-black text-[var(--text)]">
                    {t('employeeList.updateEmployeePhoto')}
                  </h3>
                </div>
              </div>

              <div className="mt-5">
                <AvatarUpload
                  email={showAvatarModal.employee.email}
                  name={showAvatarModal.employee.name}
                  currentImageUrl={showAvatarModal.employee.imageUrl}
                  label={t('employeeList.uploadEmployeePhoto')}
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
                className="mt-5 w-full rounded-xl border border-hi px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition duration-150 motion-reduce:transition-none hover:text-[var(--text)]"
                onClick={() => setShowAvatarModal({ open: false })}
              >
                {t('common.close')}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
