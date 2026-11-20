import React from 'react';
import type { Employee } from './types';

interface SalaryEditModalProps {
  employee: Employee;
  editSalary: number;
  onSalaryChange: (value: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export const SalaryEditModal: React.FC<SalaryEditModalProps> = ({
  employee,
  editSalary,
  onSalaryChange,
  onCancel,
  onSubmit,
}) => (
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
        Update {employee.name}
      </h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{employee.position}</p>

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
        onChange={(event) => onSalaryChange(Number(event.target.value))}
        className="mt-2 w-full rounded-2xl border border-hi bg-[var(--surface-hi)] px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:rgba(74,240,184,0.18)]"
      />

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-hi px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition hover:brightness-110"
        >
          Save salary
        </button>
      </div>
    </div>
  </div>
);
