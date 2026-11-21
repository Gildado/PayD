import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type React from 'react';

const notifySuccessMock = vi.fn();
const notifyMock = vi.fn();
const clearSavedDataMock = vi.fn();

vi.mock('@stellar/design-system', () => ({
  Alert: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div role="alert">
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  ),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement> & { fieldSize?: string }) => {
    const sanitizedProps = { ...props };
    delete sanitizedProps.fieldSize;
    return <input {...sanitizedProps} />;
  },
  Select: (
    props: React.SelectHTMLAttributes<HTMLSelectElement> & {
      children: React.ReactNode;
      label?: string;
      note?: string;
      fieldSize?: string;
    }
  ) => {
    const { children, label, note } = props;
    const sanitizedProps = { ...props };
    delete sanitizedProps.fieldSize;
    delete sanitizedProps.children;
    delete sanitizedProps.label;
    delete sanitizedProps.note;

    return (
      <label>
        {label}
        <select {...sanitizedProps}>{children}</select>
        {note ? <span>{note}</span> : null}
      </label>
    );
  },
}));

vi.mock('../components/AutosaveIndicator', () => ({
  AutosaveIndicator: () => <div data-testid="autosave-indicator" />,
}));

vi.mock('../components/FormField', () => ({
  FormField: ({
    children,
    id,
    label,
    error,
    helpText,
  }: {
    children: React.ReactNode;
    id: string;
    label: string;
    error?: string;
    helpText?: string;
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      {children}
      {helpText ? <p>{helpText}</p> : null}
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

vi.mock('../components/HelpLink', () => ({
  HelpLink: () => <span data-testid="help-link" />,
}));

vi.mock('../components/WalletQRCode', () => ({
  WalletQRCode: ({ walletAddress }: { walletAddress: string }) => (
    <div data-testid="wallet-qr">{walletAddress}</div>
  ),
}));

vi.mock('../components/EmployeeList', () => ({
  EmployeeList: ({ employees }: { employees: Array<{ id: string; name: string }> }) => (
    <div data-testid="employee-list">
      {employees.map((employee) => (
        <span key={employee.id}>{employee.name}</span>
      ))}
    </div>
  ),
}));

vi.mock('../hooks/useAutosave', () => ({
  useAutosave: () => ({
    saving: false,
    lastSaved: null,
    loadSavedData: () => null,
    clearSavedData: clearSavedDataMock,
  }),
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: () => ({
    notifySuccess: notifySuccessMock,
    notify: notifyMock,
  }),
}));

vi.mock('../services/stellar', () => ({
  generateWallet: () => ({
    publicKey: 'GATESTWALLET1234567890123456789012345678901234567890123',
    secretKey: 'SATESTSECRET1234567890123456789012345678901234567890123',
  }),
}));

const MOCK_SECRET = 'S' + 'A'.repeat(55);
const MOCK_PUBLIC = 'G' + 'B'.repeat(55);

vi.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromSecret: () => ({ publicKey: () => MOCK_PUBLIC }),
    random: () => ({ publicKey: () => MOCK_PUBLIC, secret: () => MOCK_SECRET }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) =>
      typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key,
  }),
}));

import EmployeeEntry, { validateEmailDomain } from '../pages/EmployeeEntry';

describe('EmployeeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'creates an employee, generates a wallet, and returns the employee to the directory',
    () => {
    render(<EmployeeEntry />);

    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Jane Smith' },
    });
    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'jane.smith@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Role / Team'), {
      target: { value: 'Payroll Analyst' },
    });
    fireEvent.change(screen.getByLabelText('Monthly Salary'), {
      target: { value: '2600' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create employee record/i }));

    expect(notifySuccessMock).toHaveBeenCalledWith(
      'Jane Smith added successfully',
      'A Stellar wallet was generated and is ready to share securely.'
    );
    expect(clearSavedDataMock).toHaveBeenCalled();
    expect(screen.getByTestId('wallet-qr')).toHaveTextContent(
      'GATESTWALLET1234567890123456789012345678901234567890123'
    );

    fireEvent.click(screen.getByRole('button', { name: /view employee directory/i }));

    expect(screen.getByTestId('employee-list')).toHaveTextContent('Jane Smith');
  }, 15000);

  it('shows a validation error and blocks submission when secret key confirmation does not match', () => {
    render(<EmployeeEntry />);

    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Jane Smith' },
    });
    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'jane.smith@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Role / Team'), {
      target: { value: 'Payroll Analyst' },
    });

    // Enter a valid-format secret key so the confirm field appears
    fireEvent.change(screen.getByLabelText('Wallet Secret Key'), {
      target: { value: MOCK_SECRET },
    });

    // Enter a different value in the confirm field
    fireEvent.change(screen.getByLabelText('Confirm Wallet Secret Key'), {
      target: { value: 'S' + 'C'.repeat(55) },
    });

    fireEvent.click(screen.getByRole('button', { name: /create employee record/i }));

    // Submission must be blocked
    expect(notifySuccessMock).not.toHaveBeenCalled();
    // Mismatch error must be visible
    expect(screen.getByText('Secret keys do not match')).toBeTruthy();
  });

  it('derives the wallet address from a manually entered secret key when confirmations match', () => {
    render(<EmployeeEntry />);

    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Bob Jones' },
    });
    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'bob@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Role / Team'), {
      target: { value: 'Engineer' },
    });

    fireEvent.change(screen.getByLabelText('Wallet Secret Key'), {
      target: { value: MOCK_SECRET },
    });
    fireEvent.change(screen.getByLabelText('Confirm Wallet Secret Key'), {
      target: { value: MOCK_SECRET },
    });

    fireEvent.click(screen.getByRole('button', { name: /create employee record/i }));

    expect(notifySuccessMock).toHaveBeenCalledWith(
      'Bob Jones added successfully',
      'A Stellar wallet was generated and is ready to share securely.'
    );
    expect(screen.getByTestId('wallet-qr')).toHaveTextContent(MOCK_PUBLIC);
  });

  it('accepts any domain when ALLOWED_EMAIL_DOMAINS is empty', () => {
    render(<EmployeeEntry />);
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));
    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'test@gmail.com' },
    });
    fireEvent.change(screen.getByLabelText('Role / Team'), {
      target: { value: 'Engineer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create employee record/i }));
    expect(notifySuccessMock).toHaveBeenCalled();
  });

  it('displays a non-blocking warning when an existing wallet address is entered on blur', () => {
    render(<EmployeeEntry />);
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    const walletInput = screen.getByLabelText(/Stellar Wallet Address/i);
    fireEvent.change(walletInput, {
      target: { value: 'GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6' },
    });
    fireEvent.blur(walletInput);

    expect(
      screen.getByText(/Warning: This wallet address already exists in your organization \(Wilfred G\.\)/i)
    ).toBeInTheDocument();
  });

  it('displays a non-blocking warning when an existing email is entered on blur', () => {
    render(<EmployeeEntry />);
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    const emailInput = screen.getByLabelText('Work Email');
    fireEvent.change(emailInput, {
      target: { value: 'chinelo@example.com' },
    });
    fireEvent.blur(emailInput);

    expect(
      screen.getByText(/Warning: This email already exists in your organization \(Chinelo A\.\)/i)
    ).toBeInTheDocument();
  });

  it('clears the duplicate warning when the input value is modified', () => {
    render(<EmployeeEntry />);
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    const walletInput = screen.getByLabelText(/Stellar Wallet Address/i);
    fireEvent.change(walletInput, {
      target: { value: 'GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6' },
    });
    fireEvent.blur(walletInput);
    expect(
      screen.getByText(/Warning: This wallet address already exists in your organization/i)
    ).toBeInTheDocument();

    fireEvent.change(walletInput, {
      target: { value: 'GNEWWALLETADDRESS' },
    });
    expect(
      screen.queryByText(/Warning: This wallet address already exists in your organization/i)
    ).toBeNull();
  });

  it('allows submission even when a duplicate warning is displayed (non-blocking)', () => {
    render(<EmployeeEntry />);
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Duplicate Tester' },
    });
    fireEvent.change(screen.getByLabelText('Work Email'), {
      target: { value: 'wilfred@example.com' },
    });
    fireEvent.blur(screen.getByLabelText('Work Email'));

    expect(
      screen.getByText(/Warning: This email already exists in your organization/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Role / Team'), {
      target: { value: 'Consultant' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create employee record/i }));

    expect(notifySuccessMock).toHaveBeenCalledWith(
      'Duplicate Tester added successfully',
      expect.any(String)
    );
  });

  it('checks via API and displays warning when duplicate is reported by API on blur', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        isDuplicateWallet: true,
        message: 'Warning: Address already claimed by another team.',
      }),
    } as Response);

    render(<EmployeeEntry />);
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    const walletInput = screen.getByLabelText(/Stellar Wallet Address/i);
    fireEvent.change(walletInput, {
      target: { value: 'GUNMOCKEDADDRESS12345' },
    });
    fireEvent.blur(walletInput);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/employees/check-duplicate?walletAddress=GUNMOCKEDADDRESS12345'),
      expect.any(Object)
    );

    const warning = await screen.findByText('Warning: Address already claimed by another team.');
    expect(warning).toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});

describe('validateEmailDomain', () => {
  it('returns null for unrestricted domain when allowed list is empty', () => {
    expect(validateEmailDomain('test@gmail.com', [])).toBeNull();
  });

  it('returns null for email matching an allowed domain', () => {
    const allowed = ['company.com', 'org.co'];
    expect(validateEmailDomain('user@company.com', allowed)).toBeNull();
  });

  it('returns error for email not matching any allowed domain', () => {
    const allowed = ['company.com'];
    const result = validateEmailDomain('user@gmail.com', allowed);
    expect(result).toContain('allowed domain');
    expect(result).toContain('company.com');
  });

  it('returns error for invalid email format', () => {
    expect(validateEmailDomain('not-an-email', ['company.com'])).toBe(
      'Enter a valid email address'
    );
  });

  it('returns error for empty email', () => {
    expect(validateEmailDomain('', ['company.com'])).toBe('Work email is required');
  });
});
