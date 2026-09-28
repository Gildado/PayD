import React from 'react';
import * as Sentry from '@sentry/react';

type FallbackProps = { resetError?: () => void; error?: Error | null };

type GlobalErrorBoundaryProps = {
  fallback: React.ComponentType<FallbackProps> | React.ReactElement<FallbackProps>;
  children: React.ReactNode;
};

type GlobalErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
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
      },
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      const props: FallbackProps = { resetError: this.resetError, error: this.state.error };

      if (React.isValidElement(fallback)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, react-x/no-clone-element
        return React.cloneElement(fallback as React.ReactElement<any>, props);
      }

      if (typeof fallback === 'function') {
        const FallbackComponent = fallback;
        return <FallbackComponent {...props} />;
      }
    }

    return this.props.children;
  }
}
