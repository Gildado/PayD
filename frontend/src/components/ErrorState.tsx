import React from 'react';
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
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 py-12 px-6 text-center ${className}`}
      role="alert"
    >
      <AlertTriangle size={48} className="mb-4 text-red-400" aria-hidden="true" />

      <h3 className="text-lg font-semibold text-red-300">{title}</h3>

      {message && <p className="mt-2 text-sm text-red-200/80 max-w-md">{message}</p>}

      {code && (
        <div className="mt-3 inline-block rounded bg-red-500/20 px-3 py-1 font-mono text-xs text-red-300">
          Error: {code}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            type="button"
          >
            {isRetrying && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        )}

        {action && (
          <button
            onClick={action.onClick}
            className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 font-medium hover:bg-red-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50"
            type="button"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
};
