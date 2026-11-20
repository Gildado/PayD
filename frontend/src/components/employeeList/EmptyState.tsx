import React from 'react';
import { Users } from 'lucide-react';

export const EmptyState: React.FC<{ searchQuery: string }> = ({ searchQuery }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center sm:px-12">
    <Users className="h-12 w-12 text-[var(--muted)] opacity-30" aria-hidden />
    <p className="text-base font-semibold text-[var(--text)]">
      {searchQuery ? `No employees match "${searchQuery}"` : 'No employees found'}
    </p>
    <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
      {searchQuery
        ? 'Try a different name, email, wallet, or role keyword.'
        : 'Add employees individually or import a CSV to build your payroll roster.'}
    </p>
  </div>
);
