import React from 'react';
import { InboxIcon } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ArrowButton } from './common/Button';

export type EmptyStateIllustration = 'employees' | 'transactions' | 'reports' | 'search';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /**
   * Icon component to display. Ignored when `illustration` is set.
   */
  icon?: React.ReactNode;
  /**
   * Built-in, theme-aware illustration for common empty lists (#1502).
   */
  illustration?: EmptyStateIllustration;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Primary action — rendered as a solid rounded CTA button.
   */
  primaryAction?: EmptyStateAction;
  /**
   * Secondary action — rendered as an arrow-icon text link.
   */
  secondaryAction?: EmptyStateAction;
  /**
   * `compact` trims padding and art size for use inside cards and tables.
   */
  size?: 'default' | 'compact';
  /**
   * Heading level for the title so it fits the surrounding outline.
   */
  headingLevel?: 2 | 3 | 4;
  /**
   * Additional CSS classes
   */
  className?: string;
}

// ── Illustrations ────────────────────────────────────────────────────────────
// Drawn with token-driven classes from styles/feedback.css so they follow
// light/dark mode and white-label brand colours without extra props.

function EmployeesArt() {
  return (
    <svg viewBox="0 0 160 120" className="empty-state-art">
      <ellipse className="empty-state-art-backdrop" cx="80" cy="64" rx="72" ry="50" />
      <rect className="empty-state-art-panel" x="30" y="26" width="100" height="72" rx="14" />
      <circle className="empty-state-art-primary" cx="56" cy="52" r="10" />
      <rect className="empty-state-art-line" x="72" y="46" width="42" height="6" rx="3" />
      <rect className="empty-state-art-line" x="72" y="56" width="28" height="5" rx="2.5" />
      <circle className="empty-state-art-accent" cx="56" cy="78" r="8" opacity="0.85" />
      <rect className="empty-state-art-line" x="72" y="73" width="36" height="6" rx="3" />
      <rect className="empty-state-art-line" x="72" y="83" width="22" height="5" rx="2.5" />
      <circle className="empty-state-art-primary" cx="128" cy="30" r="13" />
      <path className="empty-state-art-on-primary" d="M128 24v12M122 30h12" />
    </svg>
  );
}

function TransactionsArt() {
  return (
    <svg viewBox="0 0 160 120" className="empty-state-art">
      <ellipse className="empty-state-art-backdrop" cx="80" cy="64" rx="72" ry="50" />
      <rect className="empty-state-art-panel" x="34" y="20" width="92" height="84" rx="14" />
      <rect className="empty-state-art-line" x="48" y="36" width="44" height="6" rx="3" />
      <rect className="empty-state-art-line" x="98" y="36" width="14" height="6" rx="3" />
      <rect className="empty-state-art-line" x="48" y="54" width="36" height="6" rx="3" />
      <rect className="empty-state-art-line" x="98" y="54" width="14" height="6" rx="3" />
      <rect className="empty-state-art-line" x="48" y="72" width="40" height="6" rx="3" />
      <rect className="empty-state-art-line" x="98" y="72" width="14" height="6" rx="3" />
      <circle className="empty-state-art-accent" cx="122" cy="90" r="15" />
      <path className="empty-state-art-on-primary" d="M115 87h14l-4-4M129 93h-14l4 4" />
    </svg>
  );
}

function ReportsArt() {
  return (
    <svg viewBox="0 0 160 120" className="empty-state-art">
      <ellipse className="empty-state-art-backdrop" cx="80" cy="64" rx="72" ry="50" />
      <rect className="empty-state-art-panel" x="30" y="22" width="100" height="78" rx="14" />
      <rect className="empty-state-art-line" x="44" y="34" width="38" height="6" rx="3" />
      <rect className="empty-state-art-primary" x="46" y="70" width="12" height="18" rx="3" />
      <rect className="empty-state-art-accent" x="66" y="58" width="12" height="30" rx="3" />
      <rect className="empty-state-art-primary" x="86" y="64" width="12" height="24" rx="3" />
      <rect className="empty-state-art-accent" x="106" y="50" width="12" height="38" rx="3" />
      <path className="empty-state-art-stroke" d="M46 58l20-10 20 6 26-14" />
    </svg>
  );
}

function SearchArt() {
  return (
    <svg viewBox="0 0 160 120" className="empty-state-art">
      <ellipse className="empty-state-art-backdrop" cx="80" cy="64" rx="72" ry="50" />
      <rect className="empty-state-art-panel" x="26" y="30" width="86" height="62" rx="14" />
      <rect className="empty-state-art-line" x="40" y="44" width="46" height="6" rx="3" />
      <rect className="empty-state-art-line" x="40" y="58" width="34" height="6" rx="3" />
      <rect className="empty-state-art-line" x="40" y="72" width="40" height="6" rx="3" />
      <circle className="empty-state-art-panel" cx="110" cy="66" r="20" strokeWidth="2" />
      <circle className="empty-state-art-stroke" cx="110" cy="66" r="13" />
      <path className="empty-state-art-stroke-accent" d="M120 76l14 14" strokeWidth="5" />
    </svg>
  );
}

const ILLUSTRATIONS: Record<EmptyStateIllustration, React.FC> = {
  employees: EmployeesArt,
  transactions: TransactionsArt,
  reports: ReportsArt,
  search: SearchArt,
};

// ── Component ────────────────────────────────────────────────────────────────

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  size = 'default',
  headingLevel = 3,
  className = '',
}) => {
  const reduceMotion = useReducedMotion();
  const compact = size === 'compact';
  const Heading = `h${headingLevel}` as const;
  const Art = illustration ? ILLUSTRATIONS[illustration] : null;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-center ${
        compact ? 'px-4 py-8 sm:px-6' : 'px-6 py-12 sm:px-10 sm:py-16'
      } ${className}`}
      role="status"
    >
      {Art ? (
        <div
          className={`${compact ? 'w-28' : 'w-36 sm:w-40'} ${reduceMotion ? '' : 'motion-route-in'}`}
          aria-hidden="true"
        >
          <Art />
        </div>
      ) : (
        <div
          className={`motion-empty-illustration mb-4 ${reduceMotion ? 'motion-empty-illustration-reduced' : ''}`}
          aria-hidden="true"
        >
          <span className="motion-empty-illustration-halo" />
          <span className="motion-empty-illustration-orbit motion-empty-illustration-orbit-one" />
          <span className="motion-empty-illustration-orbit motion-empty-illustration-orbit-two" />
          <span className="motion-empty-illustration-icon">
            {icon || <InboxIcon size={44} strokeWidth={1.5} />}
          </span>
        </div>
      )}

      <Heading
        className={`mt-4 font-bold text-[var(--text)] ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}
        style={{ fontFamily: 'var(--font-head)' }}
      >
        {title}
      </Heading>

      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-5">
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-sm)] transition-[filter,transform] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] motion-safe:active:scale-[0.98] sm:w-auto"
              type="button"
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryAction && (
            <ArrowButton
              onClick={secondaryAction.onClick}
              className="text-sm hover:underline hover:underline-offset-4"
            >
              {secondaryAction.label}
            </ArrowButton>
          )}
        </div>
      )}
    </div>
  );
};
