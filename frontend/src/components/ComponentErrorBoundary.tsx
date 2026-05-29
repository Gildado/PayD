import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

      const errorLabel = this.props.componentName
        ? `${this.props.componentName} encountered an error`
        : 'Component Error';

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center p-6 rounded-xl border border-[rgba(255,123,114,0.28)] bg-[rgba(255,123,114,0.05)]"
        >
          <div className="flex items-center gap-2 text-[var(--danger)] mb-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <span className="font-medium text-sm">{errorLabel}</span>
          </div>
          <p className="text-xs text-[var(--muted)] mb-4 text-center max-w-xs">
            This section encountered an error. You can try again or refresh the page.
          </p>
          <button
            ref={this.resetButtonRef}
            type="button"
            onClick={this.resetError}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-hi)] bg-[var(--surface-hi)] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)] hover:border-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
