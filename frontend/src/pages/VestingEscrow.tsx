/**
 * VestingEscrow
 *
 * UI for interacting with the vesting_escrow Soroban contract.
 * Allows beneficiaries to view their vesting schedule and claim
 * unlocked tokens. Contract errors are decoded and displayed via
 * ContractErrorPanel.
 *
 * Issue: https://github.com/Gildado/PayD/issues/82
 */

import { useState } from 'react';
import { Heading, Text, Button, Input } from '@stellar/design-system';
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { useNotification } from '../hooks/useNotification';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VestingSchedule {
  totalAmount: string;
  claimedAmount: string;
  claimableAmount: string;
  startDate: string;
  endDate: string;
  cliffDate: string;
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Simulates fetching a vesting schedule from the Soroban contract. */
async function mockFetchSchedule(beneficiary: string): Promise<VestingSchedule> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (!beneficiary.startsWith('G') || beneficiary.length < 10) {
    throw new Error('HostError: Value(ContractError(4))');
  }
  return {
    totalAmount: '100,000',
    claimedAmount: '25,000',
    claimableAmount: '12,500',
    startDate: '2024-01-01',
    endDate: '2025-12-31',
    cliffDate: '2024-04-01',
  };
}

/** Simulates calling the claim function on the Soroban contract. */
async function mockClaimTokens(beneficiary: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  if (!beneficiary.startsWith('G')) {
    throw new Error('HostError: Value(ContractError(3))');
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VestingEscrow() {
  const { notifySuccess, notifyError } = useNotification();
  const [beneficiary, setBeneficiary] = useState('');
  const [schedule, setSchedule] = useState<VestingSchedule | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [contractErrorXdr, setContractErrorXdr] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!beneficiary.trim()) {
      notifyError('Missing input', 'Please enter a beneficiary address.');
      return;
    }
    setIsFetching(true);
    setSchedule(null);
    setContractErrorXdr(null);
    try {
      const result = await mockFetchSchedule(beneficiary);
      setSchedule(result);
    } catch (err) {
      const xdr = err instanceof Error ? err.message : String(err);
      setContractErrorXdr(xdr);
      notifyError('Contract error', 'Could not fetch vesting schedule.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleClaim = async () => {
    setIsClaiming(true);
    setContractErrorXdr(null);
    try {
      await mockClaimTokens(beneficiary);
      notifySuccess('Tokens claimed!', `${schedule?.claimableAmount ?? ''} USDC sent to your wallet.`);
      setSchedule((prev) =>
        prev
          ? {
              ...prev,
              claimedAmount: String(
                Number(prev.claimedAmount.replace(/,/g, '')) +
                  Number(prev.claimableAmount.replace(/,/g, ''))
              ),
              claimableAmount: '0',
            }
          : null
      );
    } catch (err) {
      const xdr = err instanceof Error ? err.message : String(err);
      setContractErrorXdr(xdr);
      notifyError('Claim failed', 'Contract returned an error. See details below.');
    } finally {
      setIsClaiming(false);
    }
  };

  const progress = schedule
    ? Math.round(
        (Number(schedule.claimedAmount.replace(/,/g, '')) /
          Number(schedule.totalAmount.replace(/,/g, ''))) *
          100
      )
    : 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-4xl mx-auto w-full">
      {/* Page header */}
      <div className="w-full mb-12 border-b border-hi pb-8">
        <Heading as="h1" size="lg" weight="bold" addlClassName="mb-2 tracking-tight">
          Vesting{' '}
          <span className="text-accent">Escrow</span>
        </Heading>
        <Text as="p" size="sm" weight="regular" addlClassName="text-muted font-mono tracking-wider uppercase">
          Token vesting schedule &amp; claim interface
        </Text>
      </div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: lookup form */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="card glass noise">
            <Heading as="h3" size="xs" weight="bold" addlClassName="mb-4">
              Beneficiary Lookup
            </Heading>

            <div className="flex flex-col gap-4">
              <Input
                id="beneficiary"
                fieldSize="md"
                label="Beneficiary Address"
                placeholder="G..."
                value={beneficiary}
                onChange={(e) => {
                  setBeneficiary(e.target.value);
                  setContractErrorXdr(null);
                }}
              />
              <Button
                variant="primary"
                size="md"
                isFullWidth
                disabled={isFetching}
                onClick={() => {
                  void handleLookup();
                }}
              >
                {isFetching ? 'Looking up...' : 'Fetch Schedule'}
              </Button>
            </div>
          </div>

          {/* Contract error panel */}
          {contractErrorXdr && (
            <ContractErrorPanel
              resultXdr={contractErrorXdr}
              onDismiss={() => setContractErrorXdr(null)}
            />
          )}

          {/* Schedule card */}
          {schedule && (
            <div className="card glass noise flex flex-col gap-5">
              <Heading as="h3" size="xs" weight="bold">
                Vesting Schedule
              </Heading>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Claimed</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Total', value: `${schedule.totalAmount} USDC` },
                  { label: 'Claimed', value: `${schedule.claimedAmount} USDC` },
                  { label: 'Available', value: `${schedule.claimableAmount} USDC` },
                  { label: 'Cliff Date', value: schedule.cliffDate },
                  { label: 'Start', value: schedule.startDate },
                  { label: 'End', value: schedule.endDate },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider block mb-0.5">
                      {label}
                    </span>
                    <span className="font-mono font-semibold">{value}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="primary"
                size="md"
                isFullWidth
                disabled={isClaiming || schedule.claimableAmount === '0'}
                onClick={() => {
                  void handleClaim();
                }}
              >
                {isClaiming
                  ? 'Claiming...'
                  : schedule.claimableAmount === '0'
                    ? 'Nothing to Claim'
                    : `Claim ${schedule.claimableAmount} USDC`}
              </Button>
            </div>
          )}
        </div>

        {/* Right: info panel */}
        <div className="lg:col-span-2">
          <div className="card glass noise h-fit">
            <Heading as="h3" size="xs" weight="bold" addlClassName="mb-4">
              How Vesting Works
            </Heading>
            <Text as="p" size="xs" weight="regular" addlClassName="text-muted leading-relaxed mb-4">
              Token vesting ensures long-term alignment by releasing funds over a defined schedule.
            </Text>
            <ul className="text-xs text-muted space-y-2 list-disc pl-4 font-medium">
              <li>Tokens are locked in a Soroban escrow contract</li>
              <li>A cliff period must pass before any tokens are claimable</li>
              <li>Tokens unlock linearly after the cliff date</li>
              <li>Claims execute directly on-chain via contract invocation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
