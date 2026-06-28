import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryClient } from '@tanstack/react-query';
import { AppProviders } from './providers/AppProviders.tsx';
import * as Sentry from '@sentry/react';
import './i18n';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (import.meta.env.MODE === 'production' && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders queryClient={queryClient}>
      <App />
    </AppProviders>
  </React.StrictMode>
);
