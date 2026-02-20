import React from "react";
import * as Sentry from "@sentry/react";

type ErrorBoundaryProps = {
    fallback: React.ReactNode;
    children: React.ReactNode;
};

type ErrorBoundaryState = {
    hasError: boolean;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
    };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
        Sentry.captureException(error, {
            extra: {
                componentStack: errorInfo.componentStack,
            },
        });
    }

    private handleReset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (this.state.hasError) {
            if (React.isValidElement(this.props.fallback)) {
                const fallbackElement = this.props.fallback as React.ReactElement<{ onReset?: () => void }>;
                return React.cloneElement(fallbackElement, {
                    onReset: this.handleReset,
                });
            }
            return this.props.fallback;
        }

        return this.props.children;
    }
}
