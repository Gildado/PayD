import React from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { ArrowUpDown, Check, Copy, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '../Avatar';
import { EmployeeSkeletonRow, SKELETON_ROW_COUNT } from './EmployeeSkeleton';
import type { Employee } from './types';
import { shortenWallet } from './utils';

interface EmployeeTableProps {
  displayedEmployees: Employee[];
  isLoading: boolean;
  reorderMode: boolean;
  showEmptyState: boolean;
  sortKey: keyof Employee;
  sortAsc: boolean;
  copiedId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onEmployeeClick?: (employee: Employee) => void;
  onDragEnd: (result: DropResult) => void;
  onSort: (key: keyof Employee) => void;
  onAvatarClick: (employee: Employee) => void;
  onCopyWallet: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

const COLUMNS: Array<{ key: keyof Employee; label: string; width: string }> = [
  { key: 'name' as const, label: 'Name', width: 'w-[28%]' },
  { key: 'position' as const, label: 'Role', width: 'w-[18%]' },
  { key: 'wallet' as const, label: 'Wallet', width: 'w-[18%]' },
  { key: 'salary' as const, label: 'Salary', width: 'w-[14%]' },
  { key: 'status' as const, label: 'Status', width: '' },
];

export const EmployeeTable: React.FC<EmployeeTableProps> = ({
  displayedEmployees,
  isLoading,
  reorderMode,
  showEmptyState,
  sortKey,
  sortAsc,
  copiedId,
  canEdit,
  canDelete,
  onEmployeeClick,
  onDragEnd,
  onSort,
  onAvatarClick,
  onCopyWallet,
  onEdit,
  onDelete,
}) => (
  <div className={`hidden overflow-x-auto lg:block ${showEmptyState ? 'lg:hidden' : ''}`}>
    <DragDropContext onDragEnd={onDragEnd}>
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-hi">
            {reorderMode && <th className="w-10 p-6" aria-label="Drag handle column" />}
            {COLUMNS.map((column) => (
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
                  onClick={() => !reorderMode && onSort(column.key)}
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
                                <GripVertical className="h-5 w-5" aria-hidden />
                              </div>
                            </td>
                          )}
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <button
                                type="button"
                                onClick={() => onAvatarClick(employee)}
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
                                  onClick={() => void onCopyWallet(employee)}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                    copiedId === employee.id
                                      ? 'border-[var(--success)] text-[var(--success)]'
                                      : 'border-transparent text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                                  }`}
                                  aria-label={`Copy wallet address for ${employee.name}`}
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
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="text-sm font-bold text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                                  aria-label={`Edit salary for ${employee.name}: $${(employee.salary ?? 0).toLocaleString()}`}
                                  onClick={() => onEdit(employee)}
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
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-[var(--muted)] transition-all hover:bg-[color:rgba(74,240,184,0.10)] hover:text-[var(--accent)]"
                                  aria-label={`Edit salary for ${employee.name}`}
                                  onClick={() => onEdit(employee)}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden />
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-[var(--muted)] transition-all hover:bg-[color:rgba(255,123,114,0.10)] hover:text-[var(--danger)]"
                                  aria-label={`Remove ${employee.name}`}
                                  onClick={() => onDelete(employee)}
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
);
