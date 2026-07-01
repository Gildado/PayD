import { Alert, Button, Card, Input, Select } from '@stellar/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';

const AlertComponent = Alert as unknown as React.FC<Record<string, unknown>>;
const InputComponent = Input as unknown as React.FC<Record<string, unknown>>;
const SelectComponent = Select as unknown as React.FC<Record<string, unknown>>;

import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { EmployeeList, type Employee } from '../components/EmployeeList';
import { FormField } from '../components/FormField';
import { HelpLink } from '../components/HelpLink';
import { WalletQRCode } from '../components/WalletQRCode';
import { SUPPORTED_ASSETS } from '../config/assets';
import { useAutosave } from '../hooks/useAutosave';
import { useNotification } from '../hooks/useNotification';
import { generateWallet } from '../services/stellar';
import { Keypair } from '@stellar/stellar-sdk';

interface EmployeeFormState {
  fullName: string;
  workEmail: string;
  role: string;
  walletAddress: string;
  secretKey: string;
  secretKeyConfirm: string;
  currency: string;
  salary: string;
}

interface EmployeeFormErrors {
  fullName?: string;
  workEmail?: string;
  role?: string;
  walletAddress?: string;
  secretKey?: string;
  secretKeyConfirm?: string;
  salary?: string;
}

interface EmployeeNotificationState {
  message: string;
  secretKey?: string;
  walletAddress?: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeRole?: string;
  employeeSalary?: string;
  employeeCurrency?: string;
}

// Configure allowed email domains for org-level restriction.
// Set to an empty array to allow any domain (default).
export const ALLOWED_EMAIL_DOMAINS: string[] = [];

export function validateEmailDomain(email: string, allowedDomains: string[]): string | null {
  if (!email.trim()) return 'Work email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address';
  if (allowedDomains.length > 0) {
    const domain = email.trim().split('@')[1]?.toLowerCase();
    if (!domain || !allowedDomains.includes(domain)) {
      return `Email must be from an allowed domain: ${allowedDomains.join(', ')}`;
    }
  }
  return null;
}

const initialFormState: EmployeeFormState = {
  fullName: '',
  workEmail: '',
  role: 'Contractor',
  walletAddress: '',
  secretKey: '',
  secretKeyConfirm: '',
  currency: 'USDC',
  salary: '',
};

const mockEmployees: Employee[] = [
  {
    id: '1',
    name: 'Wilfred G.',
    email: 'wilfred@example.com',
    imageUrl: '',
    position: 'Lead Developer',
    wallet: 'GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6',
    salary: 3200,
    status: 'Active',
  },
  {
    id: '2',
    name: 'Chinelo A.',
    email: 'chinelo@example.com',
    imageUrl: '',
    position: 'Product Manager',
    wallet: 'GBRPYHIL2CI3S6F7PLKJPKQG4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX',
    salary: 2800,
    status: 'Active',
  },
  {
    id: '3',
    name: 'Emeka N.',
    email: 'emeka@example.com',
    imageUrl: 'https://i.pravatar.cc/150?img=3',
    position: 'UX Designer',
    wallet: 'GD6WU3L7VY3V44J4B4C36G5TRXDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX',
    salary: 2100,
    status: 'Active',
  },
  {
    id: '4',
    name: 'Fatima K.',
    email: 'fatima@example.com',
    imageUrl: '',
    position: 'HR Specialist',
    wallet: 'GDUY2UBNPOJBSRGZWY2BOWE44XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX',
    salary: 1750,
    status: 'Inactive',
  },
];

function formatSalaryValue(value: string): string {
  if (!value.trim()) return 'Pending budget alignment';

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'Pending budget alignment';
  return `$${parsed.toLocaleString()}`;
}

export default function EmployeeEntry() {
  const [isAdding, setIsAdding] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [formData, setFormData] = useState<EmployeeFormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<EmployeeFormErrors>({});
  const [notification, setNotification] = useState<EmployeeNotificationState | null>(null);
  const { notifySuccess, notify } = useNotification();
  const { saving, lastSaved, loadSavedData, clearSavedData } = useAutosave<EmployeeFormState>(
    'employee-entry-draft',
    formData
  );
  const { t } = useTranslation();

  useEffect(() => {
    const saved = loadSavedData();
    if (saved) {
      setFormData(saved);
      notify('Recovered unsaved employee draft');
    }
  }, [loadSavedData, notify]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status !== 'Inactive').length,
    [employees]
  );
  const generatedWalletReady = Boolean(notification?.walletAddress);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));

    if (formErrors[name as keyof EmployeeFormErrors]) {
      setFormErrors((previous) => ({ ...previous, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: EmployeeFormErrors = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    const emailError = validateEmailDomain(formData.workEmail, ALLOWED_EMAIL_DOMAINS);
    if (emailError) {
      errors.workEmail = emailError;
    }

    if (!formData.role.trim()) {
      errors.role = 'Role is required';
    }

    if (formData.walletAddress && !/^G[A-Z0-9]{55}$/.test(formData.walletAddress)) {
      errors.walletAddress = 'Invalid Stellar wallet address format';
    }

    if (formData.secretKey.trim()) {
      if (!/^S[A-Z2-7]{55}$/.test(formData.secretKey.trim())) {
        errors.secretKey = 'Invalid Stellar secret key format (must start with S, 56 chars)';
      } else if (formData.secretKeyConfirm !== formData.secretKey) {
        errors.secretKeyConfirm = 'Secret keys do not match';
      }
    }

    if (formData.salary.trim()) {
      const salaryValue = Number(formData.salary);
      if (!Number.isFinite(salaryValue) || salaryValue < 0) {
        errors.salary = 'Salary must be a positive number';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    let generatedWallet: { publicKey: string; secretKey: string } | undefined;
    if (formData.secretKey.trim()) {
      const keypair = Keypair.fromSecret(formData.secretKey.trim());
      generatedWallet = { publicKey: keypair.publicKey(), secretKey: formData.secretKey.trim() };
    } else if (!formData.walletAddress) {
      generatedWallet = generateWallet();
    }

    const walletAddress = generatedWallet?.publicKey || formData.walletAddress.trim();
    const salaryValue = formData.salary.trim() ? Number(formData.salary) : 0;

    const newEmployee: Employee = {
      id: String(Date.now() + Math.random()),
      name: formData.fullName.trim(),
      email: formData.workEmail.trim().toLowerCase(),
      position: formData.role.trim(),
      wallet: walletAddress,
      salary: salaryValue,
      status: 'Active',
    };

    setEmployees((previous) => [newEmployee, ...previous]);

    notifySuccess(
      `${newEmployee.name} added successfully`,
      generatedWallet
        ? 'A Stellar wallet was generated and is ready to share securely.'
        : 'Employee details are now part of the active payroll roster.'
    );

    setNotification({
      message: `Employee ${newEmployee.name} has been added to the payroll roster.`,
      secretKey: generatedWallet?.secretKey,
      walletAddress,
      employeeName: newEmployee.name,
      employeeEmail: newEmployee.email,
      employeeRole: newEmployee.position,
      employeeSalary: formatSalaryValue(formData.salary),
      employeeCurrency: formData.currency,
    });

    setFormData(initialFormState);
    setFormErrors({});
    clearSavedData();
  };

  if (isAdding) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="inline-flex items-center gap-2 rounded-full border border-hi px-3 py-1.5 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to directory
            </button>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Guided employee setup
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--text)] sm:text-4xl">
              Add a team member with payroll-ready details.
            </h1>
          </div>
          <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(20rem,1.05fr)]">
          <Card>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Employee profile
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Capture identity, payout preferences, and optional wallet details in a single
                  flow. If no wallet is available yet, PayD will generate one for claimable balance
                  delivery.
                </p>
              </div>

              {notification ? (
                <AlertComponent variant="success" title="Employee saved" placement="inline">
                  {notification.message}
                </AlertComponent>
              ) : null}

              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormField id="fullName" label="Full Name" required error={formErrors.fullName}>
                    <InputComponent
                      fieldSize="md"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Jane Smith"
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2">
                  <FormField
                    id="workEmail"
                    label="Work Email"
                    required
                    error={formErrors.workEmail}
                  >
                    <InputComponent
                      fieldSize="md"
                      id="workEmail"
                      name="workEmail"
                      value={formData.workEmail}
                      onChange={handleChange}
                      placeholder="jane.smith@company.com"
                    />
                  </FormField>
                </div>

                <FormField id="role" label="Role / Team" required error={formErrors.role}>
                  <InputComponent
                    fieldSize="md"
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    placeholder="Finance Operations Specialist"
                  />
                </FormField>

                <FormField
                  id="salary"
                  label="Monthly Salary"
                  error={formErrors.salary}
                  helpText="Optional. Leave blank if salary is still being finalized."
                >
                  <InputComponent
                    fieldSize="md"
                    id="salary"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    placeholder="2500"
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField
                    id="walletAddress"
                    label="Stellar Wallet Address"
                    error={formErrors.walletAddress}
                    helpText="Optional. Leave blank to generate a wallet for claimable balance onboarding."
                  >
                    <InputComponent
                      fieldSize="md"
                      id="walletAddress"
                      name="walletAddress"
                      value={formData.walletAddress}
                      onChange={handleChange}
                      placeholder="Leave blank to generate a wallet"
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2">
                  <FormField
                    id="secretKey"
                    label="Wallet Secret Key"
                    error={formErrors.secretKey}
                    helpText="Optional. Provide only if you have an existing keypair. Leave blank to auto-generate."
                  >
                    <InputComponent
                      fieldSize="md"
                      id="secretKey"
                      name="secretKey"
                      type="password"
                      value={formData.secretKey}
                      onChange={handleChange}
                      placeholder="S… (leave blank to auto-generate)"
                    />
                  </FormField>
                </div>

                {formData.secretKey.trim() ? (
                  <div className="md:col-span-2">
                    <FormField
                      id="secretKeyConfirm"
                      label="Confirm Wallet Secret Key"
                      error={formErrors.secretKeyConfirm}
                    >
                      <InputComponent
                        fieldSize="md"
                        id="secretKeyConfirm"
                        name="secretKeyConfirm"
                        type="password"
                        value={formData.secretKeyConfirm}
                        onChange={handleChange}
                        placeholder="Re-enter the secret key to confirm"
                      />
                    </FormField>
                  </div>
                ) : null}

                <div className="md:col-span-2">
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <SelectComponent
                        id="currency"
                        fieldSize="md"
                        label="Preferred Payout Asset"
                        note="The employee should create the corresponding trustline before payouts begin."
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                      >
                        {SUPPORTED_ASSETS.map((asset) => (
                          <option key={asset.code} value={asset.code}>
                            {asset.label}
                          </option>
                        ))}
                      </SelectComponent>
                    </div>
                    <div className="pb-2">
                      <HelpLink topic="trustline" variant="icon-text" size="sm" />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(initialFormState);
                      setFormErrors({});
                      clearSavedData();
                    }}
                    className="rounded-xl border border-hi px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                  >
                    Reset draft
                  </button>
                  <Button type="submit" variant="primary" size="md">
                    Create employee record
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
                    <Users className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Active roster
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--text)]">{activeEmployees}</p>
                  </div>
                </div>
              </div>

              <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
                    <WalletCards className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Wallet outcome
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--text)]">
                      {generatedWalletReady ? 'Ready to share securely' : 'Generated after save'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)] p-2.5">
                    <ShieldCheck className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Delivery mode
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--text)]">
                      Claimable-balance friendly
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {notification?.walletAddress ? (
              <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Latest onboarding result
                    </p>
                    <h2 className="mt-1 text-xl font-black text-[var(--text)]">
                      {notification.employeeName}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="rounded-xl border border-hi px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
                  >
                    View employee directory
                  </button>
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Role
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                      {notification.employeeRole}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                      Payroll setup
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                      {notification.employeeSalary} in {notification.employeeCurrency}
                    </p>
                  </div>
                </div>

                <WalletQRCode
                  walletAddress={notification.walletAddress}
                  secretKey={notification.secretKey}
                  employeeName={notification.employeeName}
                />

                {notification.secretKey ? (
                  <div className="mt-4 rounded-2xl border border-[color:rgba(245,158,11,0.22)] bg-[color:rgba(245,158,11,0.08)] p-4 text-sm text-[var(--text)]">
                    <strong className="block text-xs uppercase tracking-[0.24em] text-[var(--accent2)]">
                      Simulated employee email
                    </strong>
                    <p className="mt-2 leading-6">
                      Share the generated wallet and secret only through a secure channel. The
                      employee should fund the wallet, create the required trustline, and then store
                      the secret offline.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  What happens next
                </p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                    <div className="flex items-center gap-3">
                      <UserPlus className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                      <p className="text-sm font-bold text-[var(--text)]">
                        Create the roster entry
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      The employee appears immediately in the directory so payroll managers can
                      continue working without leaving the page.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                      <p className="text-sm font-bold text-[var(--text)]">
                        Prepare onboarding handoff
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      If a wallet is generated, you will receive a QR code and simulated delivery
                      guidance for secure sharing.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/80 p-4">
                    <div className="flex items-center gap-3">
                      <BriefcaseBusiness className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                      <p className="text-sm font-bold text-[var(--text)]">Continue payroll setup</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Once trustlines exist, the employee can move into scheduling, payouts, and
                      transaction tracking flows.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-start px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl">
        <div className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
          <div className="card glass noise border-[var(--border-hi)] rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Workforce directory
                </p>
                <h1 className="mt-2 flex flex-wrap items-center gap-3 text-4xl font-black tracking-tight text-[var(--text)]">
                  {t('employees.title', { highlight: '' }).replace('{{highlight}}', '')}
                  <span className="text-[var(--accent)]">{t('employees.titleHighlight')}</span>
                  <HelpLink topic="add employee" variant="icon" size="sm" />
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                  {t('employees.subtitle')} Refine the roster, capture onboarding details, and keep
                  payout readiness visible without breaking the broader PayD visual language.
                </p>
              </div>

              <button
                id="tour-add-employee"
                type="button"
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--bg)] shadow-lg shadow-[rgba(74,240,184,0.12)] transition hover:brightness-110"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                Add employee
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="card rounded-[1.5rem] border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                Current roster
              </p>
              <p className="mt-2 text-3xl font-black text-[var(--text)]">{employees.length}</p>
            </div>
            <div className="card rounded-[1.5rem] border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                Active today
              </p>
              <p className="mt-2 text-3xl font-black text-[var(--accent)]">{activeEmployees}</p>
            </div>
            <div className="card rounded-[1.5rem] border-[var(--border-hi)] bg-[var(--surface)]/95 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
                Latest onboarding
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--text)]">
                {notification?.employeeName || 'No recent additions'}
              </p>
            </div>
          </div>
        </div>

        {notification ? (
          <div className="mb-6 rounded-[2rem] border border-[color:rgba(74,240,184,0.22)] bg-[color:rgba(74,240,184,0.08)] px-5 py-4">
            <p className="text-sm font-semibold text-[var(--text)]">{notification.message}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {notification.employeeName} is now available in the directory and ready for next-step
              payroll setup.
            </p>
          </div>
        ) : null}

        <EmployeeList
          employees={employees}
          onEmployeeClick={(employee) => notify(`Viewing ${employee.name}`)}
          onAddEmployee={(employee) => {
            setEmployees((previous) => [...previous, employee]);
            notifySuccess(`Added ${employee.name}`);
          }}
          onEditEmployee={(employee) => {
            setEmployees((previous) =>
              previous.map((item) => (item.id === employee.id ? employee : item))
            );
          }}
          onRemoveEmployee={(id) => {
            setEmployees((previous) => previous.filter((item) => item.id !== id));
          }}
          onUpdateEmployeeImage={(id, imageUrl) => {
            setEmployees((previous) =>
              previous.map((item) => (item.id === id ? { ...item, imageUrl } : item))
            );
          }}
        />
      </div>
    </div>
  );
}
