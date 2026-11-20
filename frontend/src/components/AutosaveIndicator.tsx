import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, RotateCcw } from 'lucide-react';
import React from 'react';

export interface AutosaveIndicatorProps {
  saving: boolean;
  lastSaved: Date | null;
  saveError?: string | null;
  onRetry?: () => void;
  isOffline?: boolean;
}

export const AutosaveIndicator: React.FC<AutosaveIndicatorProps> = ({
  saving,
  lastSaved,
  saveError,
  onRetry,
  isOffline,
}: AutosaveIndicatorProps) => {
  const { t } = useTranslation();
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (saveError) {
    return (
      <div
        className="flex items-center gap-2 text-xs font-medium text-[var(--danger,#f43f5e)]"
        role="alert"
        aria-live="assertive"
        data-testid="autosave-error"
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>{saveError}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold underline hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-[var(--danger,#f43f5e)] cursor-pointer"
            aria-label={t('common.retry') || 'Retry save'}
            data-testid="autosave-retry-button"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>{t('common.retry') || 'Retry'}</span>
          </button>
        ) : null}
      </div>
    );
  }

  if (isOffline) {
    return (
      <div
        className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-[var(--muted)]"
        role="status"
        aria-label="Offline - changes queued"
        data-testid="autosave-offline"
      >
        <div
          className="h-1.5 w-1.5 rounded-full bg-amber-400"
          aria-hidden="true"
        />
        <span className="uppercase tracking-wider">
          {t('autosave.offline') || 'Offline (queued)'}
        </span>
      </div>
    );
  }

  if (saving) {
    return (
      <div
        className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]"
        role="status"
        aria-live="polite"
        aria-label={t('autosave.saving') || 'Saving changes'}
        style={{
          transition: prefersReducedMotion
            ? 'none'
            : 'opacity var(--motion-duration-fast) var(--motion-ease-out)',
        }}
      >
        <svg
          className={`h-4 w-4 text-[var(--accent)] ${prefersReducedMotion ? '' : 'animate-spin'}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-xs uppercase tracking-widest">{t('autosave.saving')}</span>
      </div>
    );
  }

  if (lastSaved) {
    const time = lastSaved.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div
        className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-[var(--muted)]"
        role="status"
        aria-live="polite"
        aria-label={`${t('autosave.saved')} at ${time}`}
        style={{
          transition: prefersReducedMotion
            ? 'none'
            : 'opacity var(--motion-duration-fast) var(--motion-ease-out)',
        }}
      >
        <div className="relative flex items-center justify-center">
          <div
            className={`w-1.5 h-1.5 rounded-full ${prefersReducedMotion ? '' : 'motion-success-badge'}`}
            style={{ backgroundColor: 'var(--success)' }}
            aria-hidden="true"
          />
          <Check
            className={`absolute w-3 h-3 text-[var(--surface)] ${prefersReducedMotion ? '' : 'motion-success-icon'}`}
            aria-hidden="true"
          />
        </div>
        <span className="uppercase tracking-wider">
          {t('autosave.saved')} <span className="hidden sm:inline">{time}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-[var(--muted)]"
      role="status"
      aria-label={t('autosave.neverSaved') || 'Not saved yet'}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: 'rgba(var(--muted-rgb, 139,148,158), 0.4)' }}
        aria-hidden="true"
      />
      <span className="uppercase tracking-wider">{t('autosave.neverSaved')}</span>
    </div>
  );
};

AutosaveIndicator.displayName = 'AutosaveIndicator';
