import React from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import type { DraggableProvided, DraggableStateSnapshot, DropResult } from '@hello-pangea/dnd';
import { Check, Copy, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '../Avatar';
import { EmployeeSkeletonCard, SKELETON_ROW_COUNT } from './EmployeeSkeleton';
import type { Employee } from './types';

interface EmployeeCardProps {
  employee: Employee;
  reorderMode: boolean;
  dragProvided: DraggableProvided;
  dragSnapshot: DraggableStateSnapshot;
  copiedId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onEmployeeClick?: (employee: Employee) => void;
  onAvatarClick: (employee: Employee) => void;
  onCopyWallet: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  reorderMode,
  dragProvided,
  dragSnapshot,
  copiedId,
  canEdit,
  canDelete,
  onEmployeeClick,
  onAvatarClick,
  onCopyWallet,
  onEdit,
  onDelete,
}) => (
  <article
    key={employee.id}
    ref={dragProvided.innerRef}
    {...dragProvided.draggableProps}
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
        onClick={() => onAvatarClick(employee)}
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
          <button type="button" onClick={() => onEmployeeClick?.(employee)} className="min-w-0 text-left">
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
                onClick={() => void onCopyWallet(employee)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  copiedId === employee.id
                    ? 'border-[var(--success)] text-[var(--success)]'
                    : 'border-hi text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
                aria-label={`Copy wallet for ${employee.name}`}
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
          {canEdit ? (
            <button
              type="button"
              onClick={() => onEdit(employee)}
              className="inline-flex items-center gap-2 rounded-xl border border-hi px-3 py-2 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit salary
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete(employee)}
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
);

interface EmployeeCardListProps {
  displayedEmployees: Employee[];
  isLoading: boolean;
  reorderMode: boolean;
  showEmptyState: boolean;
  copiedId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  onEmployeeClick?: (employee: Employee) => void;
  onDragEnd: (result: DropResult) => void;
  onAvatarClick: (employee: Employee) => void;
  onCopyWallet: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export const EmployeeCardList: React.FC<EmployeeCardListProps> = ({
  displayedEmployees,
  isLoading,
  reorderMode,
  showEmptyState,
  copiedId,
  canEdit,
  canDelete,
  onEmployeeClick,
  onDragEnd,
  onAvatarClick,
  onCopyWallet,
  onEdit,
  onDelete,
}) => (
  <div className={`px-4 py-4 sm:px-6 lg:hidden ${showEmptyState ? 'hidden' : ''}`}>
    {isLoading ? (
      <div className="grid gap-4">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <EmployeeSkeletonCard key={index} />
        ))}
      </div>
    ) : (
      <DragDropContext onDragEnd={onDragEnd}>
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
                    <EmployeeCard
                      employee={employee}
                      reorderMode={reorderMode}
                      dragProvided={dragProvided}
                      dragSnapshot={dragSnapshot}
                      copiedId={copiedId}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEmployeeClick={onEmployeeClick}
                      onAvatarClick={onAvatarClick}
                      onCopyWallet={onCopyWallet}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
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
);
