import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { AppProviders } from '../providers/AppProviders';

// Minimal mocks so no real network or browser APIs are exercised
vi.mock('../providers/WalletProvider', () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../providers/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../providers/NotificationProvider', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../providers/SocketProvider', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../providers/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../components/GlobalErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../components/PageErrorFallback', () => ({
  default: () => <div>Error</div>,
}));

describe('AppProviders', () => {
  it('renders children inside the provider tree', () => {
    const queryClient = new QueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <span data-testid="child">Hello from child</span>
      </AppProviders>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
