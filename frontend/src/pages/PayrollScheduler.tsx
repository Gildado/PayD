import React, { useEffect, useState } from 'react';
import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { useAutosave } from '../hooks/useAutosave';
import { useTransactionSimulation } from '../hooks/useTransactionSimulation';
import { TransactionSimulationPanel } from '../components/TransactionSimulationPanel';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { createClaimableBalanceTransaction, generateWallet } from '../services/stellar';
import { useTranslation } from 'react-i18next';
import { Card, Heading, Text, Button, Input, Select } from '@stellar/design-system';
import { SchedulingWizard } from '../components/SchedulingWizard';
import { CountdownTimer } from '../components/CountdownTimer';

interface PayrollFormState {
  employeeName: string;
  amount: string;
  frequency: 'weekly' | 'monthly';
  startDate: string;
  memo?: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface PendingClaim {
  id: string;
  employeeName: string;
  amount: string;
  dateScheduled: string;
  claimantPublicKey: string;
  status: string;
}

// Mock employer secret key for simulation purposes
const MOCK_EMPLOYER_SECRET = 'SD3X5K7G7XV4K5V3M2G5QXH434M3VX6O5P3QVQO3L2PQSQQQQQQQQQQQ';

const initialFormState: PayrollFormState = {
  employeeName: '',
  amount: '',
  frequency: 'monthly',
  startDate: '',
  memo: '',
};

export default function PayrollScheduler() {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useNotification();
  const { socket, subscribeToTransaction, unsubscribeFromTransaction } = useSocket();
  const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<{
    frequency: string;
    timeOfDay: string;
  } | null>(null);
  const [nextRunDate, setNextRunDate] = useState<Date | null>(null);

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
    }
  }, [loadSavedData]);

  const handleScheduleComplete = (config: { frequency: string; timeOfDay: string }) => {
    setActiveSchedule(config);
    setIsWizardOpen(false);
    notifySuccess(
      'Payroll schedule configured!',
      `Frequency: ${config.frequency}, time: ${config.timeOfDay}`
    );

    // Compute next run for countdown demo
    const d = new Date();
    if (config.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (config.frequency === 'weekly') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 14);

    setNextRunDate(d);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (simulationResult) resetSimulation();
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
        notifySuccess('Payment confirmed!', `TX: ${data.transactionId}`);
      }
    };

    socket.on('transaction:update', handleTransactionUpdate);

    return () => {
      socket.off('transaction:update', handleTransactionUpdate);
    };
  }, [socket, notifySuccess]);

  const handleInitialize = async () => {
    if (!formData.employeeName || !formData.amount) {
      notifyError('Missing required fields', 'Please provide employee name and amount.');
      return;
    }

    // Mock XDR for simulation demonstration
    const mockXdr =
      'AAAAAgAAAABmF8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    await simulate({ envelopeXdr: mockXdr });
  };

  const handleBroadcast = async () => {
    setIsBroadcasting(true);
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
        dateScheduled: formData.startDate || new Date().toISOString().split('T')[0],
        claimantPublicKey: mockRecipientPublicKey,
        status: 'Pending Claim',
      };

      const updatedClaims = [...pendingClaims, newClaim];
      setPendingClaims(updatedClaims);
      localStorage.setItem('pending-claims', JSON.stringify(updatedClaims));

      // Subscribe to updates for this new claim
      subscribeToTransaction(newClaim.id);

      notifySuccess(
        'Broadcast successful!',
        `Claimable balance created for ${formData.employeeName}`
      );

      // Trigger Webhook Event (Internal simulation)
      try {
        await fetch('http://localhost:3001/api/webhooks/test-trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment.completed',
            payload: {
              id: newClaim.id,
              employeeName: newClaim.employeeName,
              amount: newClaim.amount,
              status: 'created',
            },
          }),
        });
      } catch {
        console.warn('Webhook test-trigger skipped (Backend might not be running)');
      }

      resetSimulation();
      setFormData(initialFormState);
    } catch (err) {
      console.error(err);
      notifyError('Broadcast failed', 'Please check your network connection and try again.');
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
          <Heading as="h1" size="lg" weight="bold" addlClassName="mb-2 tracking-tight">
            {t('payroll.title', 'Workforce')}{' '}
            <span className="text-accent">{t('payroll.titleHighlight', 'Scheduler')}</span>
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
          <button onClick={() => setIsWizardOpen(true)}>
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
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
      </div>

      {activeSchedule && (
        <div className="w-full mb-12 bg-black/20 border border-success/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-success"></div>
          <div>
            <h3 className="text-success font-black text-lg mb-1 flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Automation Active
            </h3>
            <p className="text-muted text-sm">
              Scheduled to run{' '}
              <span className="font-bold text-text capitalize">{activeSchedule.frequency}</span> at{' '}
              <span className="font-mono text-text">{activeSchedule.timeOfDay}</span>
            </p>
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
        <SchedulingWizard
          onComplete={handleScheduleComplete}
          onCancel={() => setIsWizardOpen(false)}
        />
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
                <Input
                  id="employeeName"
                  fieldSize="md"
                  label={t('payroll.employeeName', 'Employee Name')}
                  name="employeeName"
                  value={formData.employeeName}
                  onChange={handleChange}
                  placeholder="e.g. Satoshi Nakamoto"
                />
              </div>

              <div>
                <Input
                  id="amount"
                  fieldSize="md"
                  label={t('payroll.amountLabel', 'Amount (USD equivalent)')}
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Select
                  id="frequency"
                  fieldSize="md"
                  label={t('payroll.distributionFrequency', 'Distribution Frequency')}
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                >
                  <option value="weekly">{t('payroll.frequencyWeekly', 'Weekly')}</option>
                  <option value="monthly">{t('payroll.frequencyMonthly', 'Monthly')}</option>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Input
                  id="startDate"
                  fieldSize="md"
                  label={t('payroll.commencementDate', 'Commencement Date')}
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleChange}
                />
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
            <TransactionSimulationPanel
              result={simulationResult}
              isSimulating={isSimulating}
              processError={simulationProcessError}
              onReset={resetSimulation}
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
            <Text as="p" size="sm" weight="regular" addlClassName="text-muted">
              No pending claimable balances.
            </Text>
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
    </div>
  );
}
