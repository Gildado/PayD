import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export interface ErrorStateProps {
  /**
   * Error title
   */
  title: string;
  /**
   * Error message/description
   */
  message?: string;
  /**
   * Error code or type
   */
  code?: string;
  /**
   * Retry action callback
   */
  onRetry?: () => void;
  /**
   * Additional action button
   */
  action?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Whether the component is in a loading state (during retry)
   */
  isRetrying?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  code,
  onRetry,
  action,
  isRetrying = false,
  className = '',
}) => {
  const { t } = useTranslation();
  // Consumes the same --status-error semantic token EmptyState/StatusBadge
  // draw from (#1350, #1352), instead of a parallel set of hardcoded
  // Tailwind red-* classes -- one error color across the app, themeable
  // from a single place.
  const errorColor = 'var(--status-error)';
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border py-12 px-6 text-center ${className}`}
      style={{
        borderColor: `color-mix(in srgb, ${errorColor} 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${errorColor} 10%, transparent)`,
      }}
      role="alert"
    >
      <AlertTriangle
        size={48}
        className="mb-4"
        style={{ color: errorColor }}
        aria-hidden="true"
      />

      <h3 className="text-lg font-semibold" style={{ color: errorColor }}>
        {title}
      </h3>

      {message && (
        <p
          className="mt-2 text-sm max-w-md"
          style={{ color: `color-mix(in srgb, ${errorColor} 80%, var(--text))` }}
        >
          {message}
        </p>
      )}

      {code && (
        <div
          className="mt-3 inline-block rounded px-3 py-1 font-mono text-xs"
          style={{
            backgroundColor: `color-mix(in srgb, ${errorColor} 20%, transparent)`,
            color: errorColor,
          }}
        >
          {t('common.errorLabel')} {code}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-4 py-2 rounded-lg text-white font-medium transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: errorColor }}
            type="button"
          >
            {isRetrying && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {isRetrying ? t('common.retrying') : t('common.tryAgain')}
          </button>
        )}

        {action && (
          <button
            onClick={action.onClick}
            className="px-4 py-2 rounded-lg border font-medium transition-colors focus:outline-none focus:ring-2"
            style={{
              borderColor: `color-mix(in srgb, ${errorColor} 40%, transparent)`,
              color: errorColor,
            }}
            type="button"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
};
