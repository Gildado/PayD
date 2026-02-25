import React, { useEffect, useState } from 'react';
import { Heading, Text, Button, Input } from '@stellar/design-system';
import { toast } from 'sonner';
import {
  getVestingConfig,
  getClaimableAmount,
  buildClaimVestingXdr,
  buildInitializeVestingXdr,
  type VestingConfig,
} from '../services/vestingService';
import { simulateTransaction } from '../services/transactionSimulation';
import { TransactionSimulationPanel } from '../components/TransactionSimulationPanel';
import type { SimulationResult } from '../services/transactionSimulation';

// Mock source key for read-only simulation calls (sequence doesn't matter for reads)
const MOCK_READ_SOURCE = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

function formatUnixToDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function secondsToDays(seconds: number): number {
  return Math.round(seconds / 86400);
}

interface InitGrantForm {
  funder: string;
  beneficiary: string;
  token: string;
  startTime: string;
  cliffDays: string;
  durationDays: string;
  amount: string;
  clawbackAdmin: string;
}

const InitGrantFormDefault: InitGrantForm = {
  funder: '',
  beneficiary: '',
  token: '',
  startTime: '',
  cliffDays: '',
  durationDays: '',
  amount: '',
  clawbackAdmin: '',
};

export default function VestingManagement() {
  const [config, setConfig] = useState<VestingConfig | null>(null);
  const [claimable, setClaimable] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [form, setForm] = useState<InitGrantForm>(InitGrantFormDefault);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, claimableAmt] = await Promise.all([
        getVestingConfig(MOCK_READ_SOURCE),
        getClaimableAmount(MOCK_READ_SOURCE),
      ]);
      setConfig(cfg);
      setClaimable(claimableAmt);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load vesting data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleClaim = async () => {
    setIsSimulating(true);
    setSimResult(null);
    try {
      const xdr = buildClaimVestingXdr(MOCK_READ_SOURCE, '0');
      const result = await simulateTransaction({ envelopeXdr: xdr });
      setSimResult(result);
      if (!result.success) {
        toast.error('Claim simulation failed');
      } else {
        toast.success('Claim simulation passed — ready to sign and broadcast');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during claim simulation');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleInitGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimResult(null);
    try {
      const xdr = buildInitializeVestingXdr(
        MOCK_READ_SOURCE,
        form.funder,
        form.beneficiary,
        form.token,
        Math.floor(new Date(form.startTime).getTime() / 1000),
        Number(form.cliffDays) * 86400,
        Number(form.durationDays) * 86400,
        Number(form.amount),
        form.clawbackAdmin,
        '0'
      );
      const result = await simulateTransaction({ envelopeXdr: xdr });
      setSimResult(result);
      if (result.success) {
        toast.success('Grant initialization simulation passed');
      } else {
        toast.error('Grant simulation failed — review errors below');
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during grant initialization');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const vestedPercent = config
    ? Math.min(100, ((config.totalAmount - (config.totalAmount - config.claimedAmount)) / config.totalAmount) * 100)
    : 0;
  const cliffDate = config ? formatUnixToDate(config.startTime + config.cliffSeconds) : '';
  const endDate = config ? formatUnixToDate(config.startTime + config.durationSeconds) : '';

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
      <header>
        <Heading as="h1" size="lg" weight="bold" addlClassName="mb-1">
          Vesting Escrow Management
        </Heading>
        <Text as="p" size="sm" addlClassName="text-muted">
          Manage on-chain token vesting grants via the Soroban{' '}
          <code className="font-mono text-xs bg-black/20 px-1 rounded">vesting_escrow</code> contract.
        </Text>
      </header>

      {config ? (
        <>
          {/* Grant Dashboard */}
          <section className="card glass noise border border-hi">
            <div className="flex items-center justify-between mb-4">
              <Heading as="h2" size="sm" weight="bold">
                Active Vesting Grant
              </Heading>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  config.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {config.isActive ? 'Active' : 'Revoked'}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Beneficiary', value: `${config.beneficiary.slice(0, 8)}...` },
                { label: 'Total Amount', value: config.totalAmount.toLocaleString() },
                { label: 'Cliff Date', value: cliffDate },
                { label: 'End Date', value: endDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <Text as="p" size="xs" addlClassName="text-muted uppercase tracking-wide">
                    {label}
                  </Text>
                  <Text as="p" size="sm" weight="bold">
                    {value}
                  </Text>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Claimed: {config.claimedAmount.toLocaleString()}</span>
                <span>Total: {config.totalAmount.toLocaleString()}</span>
              </div>
              <div className="w-full h-3 rounded-full bg-black/30 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-accent2 transition-all duration-700"
                  style={{ width: `${vestedPercent}%` }}
                />
              </div>
              <Text as="p" size="xs" addlClassName="text-muted mt-1">
                {vestedPercent.toFixed(1)}% vested
              </Text>
            </div>

            {/* Claimable amount */}
            {claimable > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20 mb-4">
                <div>
                  <Text as="p" size="sm" weight="bold">
                    Claimable:{' '}
                    <span className="text-accent">{claimable.toLocaleString()}</span>
                  </Text>
                  <Text as="p" size="xs" addlClassName="text-muted">
                    Tokens available to withdraw now
                  </Text>
                </div>
                <Button size="sm" variant="primary" onClick={handleClaim} disabled={isSimulating}>
                  {isSimulating ? 'Simulating...' : 'Claim Tokens'}
                </Button>
              </div>
            )}

            {claimable === 0 && (
              <Text as="p" size="xs" addlClassName="text-muted italic">
                No tokens available to claim at this time.
              </Text>
            )}
          </section>

          {/* Simulation Result */}
          {simResult && (
            <TransactionSimulationPanel
              result={simResult}
              isSimulating={isSimulating}
              processError={null}
              onReset={() => setSimResult(null)}
            />
          )}
        </>
      ) : (
        <>
          {/* No active grant — show Admin form */}
          <div className="card glass noise border border-hi">
            <Heading as="h2" size="sm" weight="bold" addlClassName="mb-1">
              No Active Grant
            </Heading>
            <Text as="p" size="sm" addlClassName="text-muted mb-5">
              The vesting contract has not been initialized for this network. Use the form below to
              create a new vesting grant.
            </Text>

            <form onSubmit={handleInitGrant} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  id="funder"
                  fieldSize="md"
                  label="Funder Address (signs &amp; funds the contract)"
                  name="funder"
                  value={form.funder}
                  onChange={handleFormChange}
                  placeholder="G..."
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  id="beneficiary"
                  fieldSize="md"
                  label="Beneficiary Address"
                  name="beneficiary"
                  value={form.beneficiary}
                  onChange={handleFormChange}
                  placeholder="G..."
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  id="token"
                  fieldSize="md"
                  label="Token Contract Address"
                  name="token"
                  value={form.token}
                  onChange={handleFormChange}
                  placeholder="C..."
                />
              </div>
              <Input
                id="startTime"
                fieldSize="md"
                label="Start Date"
                name="startTime"
                type="date"
                value={form.startTime}
                onChange={handleFormChange}
              />
              <Input
                id="cliffDays"
                fieldSize="md"
                label="Cliff (days)"
                name="cliffDays"
                type="number"
                value={form.cliffDays}
                onChange={handleFormChange}
                placeholder="90"
              />
              <Input
                id="durationDays"
                fieldSize="md"
                label="Duration (days)"
                name="durationDays"
                type="number"
                value={form.durationDays}
                onChange={handleFormChange}
                placeholder="365"
              />
              <Input
                id="amount"
                fieldSize="md"
                label="Total Amount (token units)"
                name="amount"
                type="number"
                value={form.amount}
                onChange={handleFormChange}
                placeholder="100000"
              />
              <div className="md:col-span-2">
                <Input
                  id="clawbackAdmin"
                  fieldSize="md"
                  label="Clawback Admin Address"
                  name="clawbackAdmin"
                  value={form.clawbackAdmin}
                  onChange={handleFormChange}
                  placeholder="G..."
                />
              </div>
              <div className="md:col-span-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isFullWidth
                  disabled={isSimulating}
                >
                  {isSimulating ? 'Simulating Grant...' : 'Simulate Grant Initialization'}
                </Button>
              </div>
            </form>
          </div>

          {simResult && (
            <TransactionSimulationPanel
              result={simResult}
              isSimulating={isSimulating}
              processError={null}
              onReset={() => setSimResult(null)}
            />
          )}
        </>
      )}
    </main>
  );
}
