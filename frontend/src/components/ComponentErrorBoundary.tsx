import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import i18n from '../i18n';

type ComponentErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ComponentErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class ComponentErrorBoundary extends React.Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  private resetButtonRef = React.createRef<HTMLButtonElement>();

  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: {
        section: this.props.componentName,
      },
      extra: {
        componentStack: errorInfo.componentStack,
        componentName: this.props.componentName,
      },
    });

    this.props.onError?.(error as Error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  componentDidUpdate(
    _prevProps: ComponentErrorBoundaryProps,
    prevState: ComponentErrorBoundaryState
  ) {
    if (prevState.hasError && !this.state.hasError) {
      this.resetButtonRef.current?.focus();
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Class components can't use the useTranslation hook, so we read
      // directly from the shared i18n instance. This keeps the error
      // boundary translated without requiring the withTranslation HOC
      // (which several existing tests mock react-i18next without).
      const t = i18n.t.bind(i18n);
      const errorLabel = this.props.componentName
        ? t('common.componentErrorWithName', { componentName: this.props.componentName })
        : t('common.componentError');

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center p-6 rounded-lg border bg-[var(--danger)]/10"
          style={{
            borderColor: `var(--danger)`,
            transition: `all var(--motion-duration-normal) var(--motion-ease-out)`,
          }}
        >
          <div
            className="flex items-center gap-2 mb-2"
            style={{
              color: 'var(--danger)',
              animation: `fadeIn var(--motion-duration-normal) var(--motion-ease-out)`,
            }}
          >
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <span className="font-medium text-sm">{errorLabel}</span>
          </div>
          <p
            className="text-xs mb-4 text-center max-w-xs"
            style={{
              color: 'var(--muted)',
              animation: `fadeIn var(--motion-duration-normal) var(--motion-ease-out) 50ms both`,
            }}
          >
            {t('common.componentErrorDescription')}
          </p>
          <button
            ref={this.resetButtonRef}
            type="button"
            onClick={this.resetError}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              backgroundColor: 'var(--surface-hi)',
              borderColor: 'var(--border-hi)',
              color: 'var(--text)',
              transition: `all var(--motion-duration-fast) var(--motion-ease-out)`,
              animation: `slideUp var(--motion-duration-normal) var(--motion-ease-out) 100ms both`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-hi)';
              e.currentTarget.style.borderColor = 'var(--border-hi)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('common.tryAgain')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
