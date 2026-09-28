import { Button, Card, Heading, Input, Select, Text } from '@stellar/design-system';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios, { AxiosError } from 'axios';
import { CalendarDays, Clock3, PencilLine, Inbox } from 'lucide-react';

// Type assertion for Stellar components to work around library typing issues
const InputComponent = Input as unknown as React.FC<Record<string, unknown>>;
const SelectComponent = Select as unknown as React.FC<Record<string, unknown>>;

import { AccessibleDatePicker } from '../components/AccessibleDatePicker';
import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { BulkPaymentStatusTracker } from '../components/BulkPaymentStatusTracker';
import { CountdownTimer } from '../components/CountdownTimer';
import { FormField } from '../components/FormField';
import ComponentErrorBoundary from '../components/ComponentErrorBoundary';
import { PayrollScheduleForm } from '../components/payroll/PayrollScheduleForm';
import { TransactionSimulationPanel } from '../components/TransactionSimulationPanel';
import { useAutosave } from '../hooks/useAutosave';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { useTransactionSimulation } from '../hooks/useTransactionSimulation';
import { createClaimableBalanceTransaction, generateWallet } from '../services/stellar';

import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { IssuerMultisigBanner } from '../components/IssuerMultisigBanner';
import { TransactionPendingOverlay } from '../components/TransactionPendingOverlay';
import { HelpLink } from '../components/HelpLink';
import { parseContractError, type ContractErrorDetail } from '../utils/contractErrorParser';
import { formatDate } from '../utils/dateHelpers';
import axiosInstance from '../api/axiosInstance';
import {
  computeNextRunDate,
  getLocalTimezoneLabel,
  type SchedulingConfig,
} from '../utils/scheduling';

interface PayrollFormState {
  employeeName: string;
  amount: string;
  frequency: 'weekly' | 'monthly';
  startDate: string;
  memo?: string;
}

interface PayrollFormErrors {
  employeeName?: string;
  amount?: string;
  startDate?: string;
}

interface PendingClaim {
  id: string;
  employeeName: string;
  amount: string;
  dateScheduled: string;
  claimantPublicKey: string;
  status: string;
}

type OverlayStatus = 'pending' | 'success' | 'error';

// Mock employer secret key for simulation purposes
const MOCK_EMPLOYER_SECRET = 'SD3X5K7G7XV4K5V3M2G5QXH434M3VX6O5P3QVQO3L2PQSQQQQQQQQQQQ';

const initialFormState: PayrollFormState = {
  employeeName: '',
  amount: '',
  frequency: 'monthly',
  startDate: '',
  memo: '',
};

const formatLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function PayrollScheduler() {
  const { t } = useTranslation();
  const { notifySuccess, notify, notifyPaymentSuccess, notifyPaymentFailure, notifyApiError } =
    useNotification();
  const { socket, subscribeToTransaction, unsubscribeFromTransaction } = useSocket();
  const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<PayrollFormErrors>({});
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayStatus, setOverlayStatus] = useState<OverlayStatus>('pending');
  const [overlayTxHash, setOverlayTxHash] = useState<string | undefined>();
  const [activeSchedule, setActiveSchedule] = useState<SchedulingConfig | null>(null);
  const [nextRunDate, setNextRunDate] = useState<Date | null>(null);
  const [contractError, setContractError] = useState<ContractErrorDetail | null>(null);
  const timezoneLabel = getLocalTimezoneLabel();

  const scheduleStorageKey = 'payd-scheduler-config';

  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>(() => {
    const saved = localStorage.getItem('pending-claims');
    if (saved) {
      try {
        return JSON.parse(saved) as PendingClaim[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const { saving, lastSaved, loadSavedData } = useAutosave<PayrollFormState>(
    'payroll-scheduler-draft',
    formData
  );

  const {
    simulate,
    resetSimulation,
    isSimulating,
    result: simulationResult,
    error: simulationProcessError,
    isSuccess: simulationPassed,
  } = useTransactionSimulation();

  useEffect(() => {
    const saved = loadSavedData();
    if (saved) {
      setFormData(saved);
      notify('Recovered unsaved payroll draft');
    }
  }, [loadSavedData, notify]);

  // Restore confirmed schedule (persisted locally after wizard confirmation).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(scheduleStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SchedulingConfig;

      if (!parsed?.frequency || !parsed?.timeOfDay) return;
      if (!['weekly', 'biweekly', 'monthly'].includes(parsed.frequency)) return;
      if (!Array.isArray(parsed.preferences)) return;

      const next = computeNextRunDate(parsed, new Date());
      setActiveSchedule(parsed);
      setNextRunDate(next);
    } catch {
      // Ignore invalid local storage payloads.
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (simulationResult) {
      resetSimulation();
      setContractError(null);
    }
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof PayrollFormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: PayrollFormErrors = {};

    if (!formData.employeeName.trim()) {
      errors.employeeName = 'Employee name is required';
    }

    if (!formData.amount.trim()) {
      errors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.amount = 'Amount must be a positive number';
      }
    }

    if (!formData.startDate) {
      errors.startDate = 'Start date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartDateChange = (value: string) => {
    setFormData((prev) => ({ ...prev, startDate: value }));
    if (simulationResult) {
      resetSimulation();
      setContractError(null);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleTransactionUpdate = (data: { transactionId: string; status: string }) => {
      console.log('Received transaction update:', data);
      setPendingClaims((prev) =>
        prev.map((claim) =>
          claim.id === data.transactionId ? { ...claim, status: data.status } : claim
        )
      );

      if (data.status === 'confirmed') {
        notifyPaymentSuccess(data.transactionId, 'Payment confirmed!');
      }
    };

    socket.on('transaction:update', handleTransactionUpdate);

    return () => {
      socket.off('transaction:update', handleTransactionUpdate);
    };
  }, [socket, notifyPaymentSuccess]);

  const handleInitialize = async () => {
    if (!validateForm()) {
      return;
    }

    setContractError(null);

    // Mock XDR for simulation demonstration
    const mockXdr =
      'AAAAAgAAAABmF8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    const result = await simulate({ envelopeXdr: mockXdr });
    if (result && !result.success) {
      const parsed = parseContractError(result.envelopeXdr, result.description);
      setContractError(parsed);
    }
  };

  const handleBroadcast = async () => {
    setIsBroadcasting(true);
    setContractError(null);
    setOverlayVisible(true);
    setOverlayStatus('pending');
    setOverlayTxHash(undefined);

    try {
      const mockRecipientPublicKey = generateWallet().publicKey;

      // Integrate claimable balance logic from Issue #44
      const result = createClaimableBalanceTransaction(
        MOCK_EMPLOYER_SECRET,
        mockRecipientPublicKey,
        String(formData.amount),
        'USDC'
      );

      if (!result.success) {
        throw new Error('Failed to create claimable balance');
      }

      // Simulate a brief delay for network broadcast
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Add to pending claims
      const newClaim: PendingClaim = {
        id: Math.random().toString(36).substr(2, 9),
        employeeName: formData.employeeName,
        amount: formData.amount,
        dateScheduled: formData.startDate || formatLocalDateInput(new Date()),
        claimantPublicKey: mockRecipientPublicKey,
        status: 'Pending Claim',
      };

      const updatedClaims = [...pendingClaims, newClaim];
      setPendingClaims(updatedClaims);
      localStorage.setItem('pending-claims', JSON.stringify(updatedClaims));

      // Subscribe to updates for this new claim
      subscribeToTransaction(newClaim.id);

      // Show success overlay
      setOverlayStatus('success');
      const mockTxHash = `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setOverlayTxHash(mockTxHash);

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setOverlayVisible(false);
      }, 3000);

      notifySuccess(
        'Broadcast successful!',
        `Claimable balance created for ${formData.employeeName}`
      );

      // Trigger Webhook Event (Internal simulation)
      try {
        await axiosInstance.post('/api/webhooks/trigger', {
          eventType: 'payment.completed',
          payload: {
            id: newClaim.id,
            employeeName: newClaim.employeeName,
            amount: newClaim.amount,
            status: 'created',
          },
        });
      } catch (err: unknown) {
        const fallback = 'Payment was created, but webhook test trigger failed.';
        const errorMessage = axios.isAxiosError(err)
          ? ((err as AxiosError<{ error?: string }>).response?.data?.error ?? fallback)
          : fallback;
        notifyApiError('Webhook trigger failed', errorMessage);
        console.warn('Webhook trigger error:', err);
      }

      resetSimulation();
      setFormData(initialFormState);
    } catch (err) {
      console.error(err);
      const parsed = parseContractError(
        undefined,
        err instanceof Error ? err.message : 'Broadcast failed'
      );
      setContractError(parsed);
      notifyPaymentFailure(parsed.message);
      setOverlayStatus('error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRemoveClaim = (id: string) => {
    unsubscribeFromTransaction(id);
    const updatedClaims = pendingClaims.filter((c) => c.id !== id);
    setPendingClaims(updatedClaims);
    localStorage.setItem('pending-claims', JSON.stringify(updatedClaims));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <Heading
            as="h1"
            size="lg"
            weight="bold"
            addlClassName="mb-2 tracking-tight flex items-center gap-3"
          >
            {t('payroll.title', 'Workforce')}{' '}
            <span className="text-accent">{t('payroll.titleHighlight', 'Scheduler')}</span>
            <HelpLink topic="schedule payroll" variant="icon" size="sm" />
          </Heading>
          <Text
            as="p"
            size="sm"
            weight="regular"
            addlClassName="text-muted font-mono tracking-wider uppercase"
          >
            {t('payroll.subtitle', 'Automated distribution engine')}
          </Text>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3.5 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={activeSchedule ? 'Edit payroll schedule' : 'Configure payroll schedule'}
          >
            {activeSchedule ? (
              <>
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                Edit schedule
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Configure schedule
              </>
            )}
          </button>
        </div>
      </div>

      <IssuerMultisigBanner />

      {activeSchedule && (
        <div className="relative mb-12 flex w-full flex-col gap-6 overflow-hidden rounded-2xl border border-success/30 bg-black/20 p-6 md:flex-row md:items-center md:justify-between">
          <div className="absolute top-0 left-0 w-1 h-full bg-success"></div>
          <div className="space-y-2">
            <h3 className="mb-1 flex items-center gap-2 text-lg font-black text-success">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              Automation Active
            </h3>
            <p className="text-sm text-muted">
              Scheduled to run{' '}
              <span className="font-bold text-text capitalize">{activeSchedule.frequency}</span> at{' '}
              <span className="font-mono text-text">{activeSchedule.timeOfDay}</span> in{' '}
              <span className="font-semibold text-text">{timezoneLabel}</span>
            </p>
            {nextRunDate ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Next run window opens{' '}
                <span className="font-semibold text-text">
                  {nextRunDate.toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </p>
            ) : null}
          </div>
          <div className="bg-bg border border-hi rounded-xl p-4 shadow-inner">
            <span className="block text-[10px] uppercase font-bold text-muted mb-2 tracking-widest text-center">
              Next Scheduled Run
            </span>
            <CountdownTimer targetDate={nextRunDate} />
          </div>
        </div>
      )}

      {isWizardOpen ? (
        <div className="w-full mb-12 relative">
          <button
            type="button"
            onClick={() => setIsWizardOpen(false)}
            className="absolute -top-10 left-0 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            &larr; Back to Dashboard
          </button>
          <ComponentErrorBoundary componentName="PayrollScheduleForm">
            <PayrollScheduleForm />
          </ComponentErrorBoundary>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
          <div className="lg:col-span-3">
            <form
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault();
                void handleInitialize();
              }}
              className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 card glass noise"
            >
              <div className="md:col-span-2">
                <FormField
                  id="employeeName"
                  label={t('payroll.employeeName', 'Employee Name')}
                  required
                  error={formErrors.employeeName}
                >
                  <InputComponent
                    fieldSize="md"
                    name="employeeName"
                    value={formData.employeeName}
                    onChange={handleChange}
                    placeholder="e.g. Satoshi Nakamoto"
                  />
                </FormField>
              </div>

              <FormField
                id="amount"
                label={t('payroll.amountLabel', 'Amount (USD equivalent)')}
                required
                error={formErrors.amount}
              >
                <InputComponent
                  fieldSize="md"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </FormField>

              <div>
                <SelectComponent
                  id="frequency"
                  fieldSize="md"
                  label={t('payroll.distributionFrequency', 'Distribution Frequency')}
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                >
                  <option value="weekly">{t('payroll.frequencyWeekly', 'Weekly')}</option>
                  <option value="monthly">{t('payroll.frequencyMonthly', 'Monthly')}</option>
                </SelectComponent>
              </div>

              <div className="md:col-span-2">
                <FormField
                  id="startDate"
                  label={t('payroll.commencementDate', 'Commencement Date')}
                  required
                  error={formErrors.startDate}
                  helpText="Select the date when payroll will commence (must be today or later)"
                >
                  <AccessibleDatePicker
                    id="startDate"
                    label=""
                    value={formData.startDate}
                    onChange={handleStartDateChange}
                    minDate={formatLocalDateInput(new Date())}
                    required={true}
                  />
                </FormField>
              </div>

              <div className="md:col-span-2 pt-4">
                {!simulationPassed ? (
                  <Button
                    type="submit"
                    disabled={isSimulating}
                    variant="primary"
                    size="md"
                    isFullWidth
                  >
                    {isSimulating
                      ? 'Simulating...'
                      : t('payroll.submit', 'Initialize and Validate')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      void handleBroadcast();
                    }}
                    disabled={isBroadcasting}
                    variant="primary"
                    size="md"
                    isFullWidth
                  >
                    {isBroadcasting ? 'Broadcasting...' : 'Confirm & Broadcast to Network'}
                  </Button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <ContractErrorPanel error={contractError} onClear={() => setContractError(null)} />

            <TransactionSimulationPanel
              result={simulationResult}
              isSimulating={isSimulating}
              processError={simulationProcessError}
              onReset={() => {
                resetSimulation();
                setContractError(null);
              }}
            />

            <div className="card glass noise h-fit">
              <Heading as="h3" size="xs" weight="bold" addlClassName="mb-4 flex items-center gap-2">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Pre-flight Validation
                <HelpLink topic="transaction simulation" variant="icon" size="sm" />
              </Heading>
              <Text
                as="p"
                size="xs"
                weight="regular"
                addlClassName="text-muted leading-relaxed mb-4"
              >
                All transactions are simulated via Stellar Horizon before submission. This catches
                common errors like:
              </Text>
              <ul className="text-xs text-muted space-y-2 list-disc pl-4 font-medium">
                <li>Insufficient XLM balance for fees</li>
                <li>Invalid sequence numbers</li>
                <li>Missing trustlines for tokens</li>
                <li>Account eligibility status</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        <Heading as="h2" size="sm" weight="bold" addlClassName="mb-4">
          Pending Claims
        </Heading>
        <Card>
          {pendingClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <Inbox size={40} className="text-muted opacity-50" aria-hidden="true" />
              <Text as="p" size="sm" weight="regular" addlClassName="text-muted">
                No pending claimable balances.
              </Text>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {pendingClaims.map((claim: PendingClaim) => (
                <li key={claim.id} className="border border-hi p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <Heading as="h3" size="xs" weight="bold">
                      {claim.employeeName}
                    </Heading>
                    <span className="bg-accent/20 text-accent px-2 py-1 rounded-full text-xs">
                      {claim.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted flex justify-between items-center">
                    <div>
                      <Text as="p" size="xs" weight="regular">
                        Amount: {claim.amount} USDC
                      </Text>
                      <Text as="p" size="xs" weight="regular">
                        Scheduled: {formatDate(claim.dateScheduled)}
                      </Text>
                      <Text
                        as="p"
                        size="xs"
                        weight="regular"
                        addlClassName="font-mono truncate max-w-[200px]"
                        title={claim.claimantPublicKey}
                      >
                        To: {claim.claimantPublicKey}
                      </Text>
                    </div>
                    <button
                      onClick={() => handleRemoveClaim(claim.id)}
                      className="text-danger hover:text-danger/80 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="w-full">
        <BulkPaymentStatusTracker organizationId={1} />
      </div>

      <TransactionPendingOverlay
        isVisible={overlayVisible}
        status={overlayStatus}
        txHash={overlayTxHash}
        onDismiss={() => setOverlayVisible(false)}
      />
    </div>
  );
}
