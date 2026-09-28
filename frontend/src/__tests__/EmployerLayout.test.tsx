import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EmployerLayout from '../components/EmployerLayout';

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    network: 'TESTNET' as const,
    isInitialized: true,
  }),
}));

vi.mock('../hooks/useNativeXlmBalance', () => ({
  useNativeXlmBalance: () => ({ data: '10.25', isFetching: false }),
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: null,
    connected: false,
    isPollingFallback: false,
    subscribeToTransaction: vi.fn(),
    unsubscribeFromTransaction: vi.fn(),
    subscribeToBulk: vi.fn(),
    unsubscribeFromBulk: vi.fn(),
  }),
}));

vi.mock('../components/ConnectAccount', () => ({
  default: () => <div data-testid="connect-mock">Connect</div>,
}));

vi.mock('../components/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="lang-mock">Lang</div>,
}));

vi.mock('../components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-mock">Theme</div>,
}));

describe('EmployerLayout', () => {
  test('renders organization label, navigation, and balance', () => {
    render(
      <MemoryRouter initialEntries={['/employer/payroll']}>
        <Routes>
          <Route path="/employer" element={<EmployerLayout />}>
            <Route path="payroll" element={<div>Payroll content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /employer navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /payroll/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/wallet xlm balance/i)).toHaveTextContent(/10\.25/);
    expect(screen.getByText('Payroll content')).toBeInTheDocument();
  });
});
