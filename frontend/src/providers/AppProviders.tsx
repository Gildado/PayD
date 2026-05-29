import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './ThemeProvider';
import { NotificationProvider } from './NotificationProvider';
import { SocketProvider } from './SocketProvider';
import { AuthProvider } from './AuthProvider';
import { WalletProvider } from './WalletProvider';
import GlobalErrorBoundary from '../components/GlobalErrorBoundary';
import PageErrorFallback from '../components/PageErrorFallback';
import { ToastProvider } from './ToastProvider';

interface AppProvidersProps {
  children: React.ReactNode;
  queryClient: QueryClient;
}

/**
 * AppProviders consolidates all top-level React context providers into a single
 * wrapper component, keeping main.tsx clean and making the provider tree easy
 * to maintain and test in isolation.
 *
 * Provider order (outermost → innermost):
 *   QueryClientProvider → ThemeProvider → NotificationProvider →
 *   ToastProvider → SocketProvider → AuthProvider → WalletProvider →
 *   BrowserRouter → GlobalErrorBoundary
 */
export function AppProviders({ children, queryClient }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationProvider>
          <ToastProvider>
            <SocketProvider>
              <AuthProvider>
                <WalletProvider>
                  <BrowserRouter>
                    <GlobalErrorBoundary fallback={<PageErrorFallback />}>
                      {children}
                    </GlobalErrorBoundary>
                  </BrowserRouter>
                </WalletProvider>
              </AuthProvider>
            </SocketProvider>
          </ToastProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
