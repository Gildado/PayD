import React from 'react';
import { InboxIcon } from 'lucide-react';

export interface EmptyStateProps {
  /**
   * Icon component to display
   */
  icon?: React.ReactNode;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Primary action button
   */
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Additional CSS classes
   */
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-[var(--border-hi)] bg-[var(--surface)]/50 py-12 px-6 text-center ${className}`}
      role="status"
    >
      {icon || <InboxIcon size={48} className="mb-4 text-[var(--muted)]" />}

      <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">{title}</h3>

      {description && <p className="mt-2 text-sm text-[var(--muted)] max-w-md">{description}</p>}

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-medium hover:bg-[var(--accent)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              type="button"
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-lg border border-[var(--border-hi)] text-[var(--text)] font-medium hover:bg-[var(--surface)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--border-hi)]"
              type="button"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
