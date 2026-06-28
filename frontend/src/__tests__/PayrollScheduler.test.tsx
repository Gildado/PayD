import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type React from 'react';

vi.mock('@stellar/design-system', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Heading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement> & { fieldSize?: string }) => {
    const sanitized = { ...props };
    delete sanitized.fieldSize;
    return <input {...sanitized} />;
  },
  Select: (
    props: React.SelectHTMLAttributes<HTMLSelectElement> & {
      fieldSize?: string;
      children: React.ReactNode;
      label?: string;
    }
  ) => {
    const { children, label, ...rest } = props;
    const sanitized = { ...rest };
    delete sanitized.fieldSize;
    return (
      <label>
        {label}
        <select {...sanitized}>{children}</select>
      </label>
    );
  },
  Text: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock('../components/AccessibleDatePicker', () => ({
  AccessibleDatePicker: (props: Record<string, unknown>) => (
    <input data-testid="date-picker" {...props} />
  ),
}));

vi.mock('../components/AutosaveIndicator', () => ({
  AutosaveIndicator: () => <div data-testid="autosave-indicator" />,
}));

vi.mock('../components/BulkPaymentStatusTracker', () => ({
  default: () => <div data-testid="bulk-status-tracker" />,
  BulkPaymentStatusTracker: () => <div data-testid="bulk-status-tracker" />,
}));

vi.mock('../components/CountdownTimer', () => ({
  default: () => <div data-testid="countdown-timer" />,
  CountdownTimer: () => <div data-testid="countdown-timer" />,
}));

vi.mock('../components/FormField', () => ({
  FormField: ({
    children,
    label,
    error,
    helpText,
  }: {
    children: React.ReactNode;
    label?: string;
    error?: string;
    helpText?: string;
  }) => (
    <div>
      <label>{label}</label>
      {children}
      {helpText && <p>{helpText}</p>}
      {error && <span>{error}</span>}
    </div>
  ),
}));

vi.mock('../components/payroll/PayrollScheduleForm', () => ({
  PayrollScheduleForm: () => {
    throw new Error('Simulated wizard crash');
  },
}));

vi.mock('../components/TransactionSimulationPanel', () => ({
  default: () => <div data-testid="simulation-panel" />,
  TransactionSimulationPanel: () => <div data-testid="simulation-panel" />,
}));

vi.mock('../components/ContractErrorPanel', () => ({
  default: () => <div data-testid="contract-error-panel" />,
  ContractErrorPanel: () => <div data-testid="contract-error-panel" />,
}));

vi.mock('../components/IssuerMultisigBanner', () => ({
  default: () => <div data-testid="multisig-banner" />,
  IssuerMultisigBanner: () => <div data-testid="multisig-banner" />,
}));

vi.mock('../components/HelpLink', () => ({
  HelpLink: () => <span data-testid="help-link" />,
}));

vi.mock('../components/TransactionPendingOverlay', () => ({
  default: () => <div data-testid="pending-overlay" />,
  TransactionPendingOverlay: () => <div data-testid="pending-overlay" />,
}));

const notifyMock = vi.fn();
vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: notifyMock,
    notify: notifyMock,
    notifyPaymentSuccess: notifyMock,
    notifyPaymentFailure: notifyMock,
    notifyApiError: notifyMock,
  }),
}));

vi.mock('../hooks/useAutosave', () => ({
  useAutosave: () => ({
    saving: false,
    lastSaved: null,
    loadSavedData: () => null,
  }),
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: null,
    subscribeToTransaction: vi.fn(),
    unsubscribeFromTransaction: vi.fn(),
  }),
}));

vi.mock('../hooks/useTransactionSimulation', () => ({
  useTransactionSimulation: () => ({
    simulate: vi.fn(),
    resetSimulation: vi.fn(),
    isSimulating: false,
    result: null,
    error: null,
    isSuccess: false,
  }),
}));

vi.mock('../services/stellar', () => ({
  createClaimableBalanceTransaction: vi.fn(() => ({ success: true })),
  generateWallet: () => ({
    publicKey: 'GABCDEF12345678901234567890123456789012345678901234567890123',
    secretKey: 'SABCDEF12345678901234567890123456789012345678901234567890123',
  }),
}));

vi.mock('../api/axiosInstance', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock('../utils/scheduling', () => ({
  computeNextRunDate: () => new Date(),
  getLocalTimezoneLabel: () => 'UTC',
}));

vi.mock('../utils/dateHelpers', () => ({
  formatDate: (d: string) => d,
}));

vi.mock('../utils/contractErrorParser', () => ({
  parseContractError: () => ({ message: 'Parsed error', code: 'ERR' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import PayrollScheduler from '../pages/PayrollScheduler';

describe('PayrollScheduler error boundary', () => {
  it('catches render error in PayrollScheduleForm and shows fallback UI, keeping the rest usable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PayrollScheduler />);

    fireEvent.click(screen.getByRole('button', { name: /configure payroll schedule/i }));

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/PayrollScheduleForm encountered an error/i)).toBeTruthy();

    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    expect(tryAgainButton).toBeTruthy();
  });
});
