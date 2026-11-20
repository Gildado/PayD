import React from 'react';
import { UserCircle2 } from 'lucide-react';
import { AvatarUpload } from '../AvatarUpload';
import type { Employee } from './types';

interface AvatarModalProps {
  employee: Employee;
  onClose: () => void;
  onImageUpload: (imageUrl: string) => void;
}

export const AvatarModal: React.FC<AvatarModalProps> = ({
  employee,
  onClose,
  onImageUpload,
}) => (
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
          email={employee.email}
          name={employee.name}
          currentImageUrl={employee.imageUrl}
          label="Upload Employee Photo"
          onImageUpload={onImageUpload}
        />
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-xl border border-hi px-3 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  </div>
);
