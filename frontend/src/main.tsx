import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "./providers/WalletProvider.tsx";
import { NotificationProvider } from "./providers/NotificationProvider.tsx";
import * as Sentry from "@sentry/react";
import ErrorBoundary from "./components/ErrorBoundary";
import ErrorFallback from "./components/ErrorFallback";
import "./i18n";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (import.meta.env.MODE === "production" && sentryDsn) {
    Sentry.init({
        dsn: sentryDsn,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(),
        ],
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
    });
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <NotificationProvider>
                <WalletProvider>
                    <BrowserRouter>
                        <ErrorBoundary fallback={<ErrorFallback />}>
                            <App />
                        </ErrorBoundary>
                    </BrowserRouter>
                </WalletProvider>
            </NotificationProvider>
        </QueryClientProvider>
    </React.StrictMode>,
);
