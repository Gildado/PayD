import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

interface AutosaveIndicatorProps {
  saving: boolean;
  lastSaved: Date | null;
}

export const AutosaveIndicator = ({ saving, lastSaved }: AutosaveIndicatorProps) => {
  const { t } = useTranslation();

  if (saving) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-(--muted) font-medium transition-all duration-200 animate-in fade-in"
        role="status"
        aria-live="polite"
        aria-label={t('autosave.saving') || 'Saving changes'}
      >
        <svg
          className="animate-spin h-4 w-4 text-(--accent)"
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
        className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-(--muted) transition-all duration-200 animate-in fade-in"
        role="status"
        aria-live="polite"
        aria-label={`${t('autosave.saved')} at ${time}`}
      >
        <div className="relative flex items-center justify-center">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--success)' }}
            aria-hidden="true"
          />
          <Check
            className="absolute w-3 h-3 text-(--success) opacity-0 animate-in fade-in zoom-in duration-300"
            style={{ animationDelay: '100ms' }}
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
      className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-(--muted) transition-all duration-200"
      role="status"
      aria-label={t('autosave.neverSaved') || 'Not saved yet'}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-(--muted)/40" aria-hidden="true" />
      <span className="uppercase tracking-wider">{t('autosave.neverSaved')}</span>
    </div>
  );
};
