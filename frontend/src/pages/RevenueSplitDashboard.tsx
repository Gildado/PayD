/* eslint-disable
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-argument
*/
import { useEffect, useMemo, useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { useWallet } from '../hooks/useWallet';
import { useWalletSigning } from '../hooks/useWalletSigning';
import { contractService } from '../services/contracts';
import {
  fetchDistributionEvents,
  fetchRevenueSplitAllocations,
  updateRevenueAllocations,
  type DistributionEvent,
  type RevenueAllocation,
} from '../services/revenueSplit';

const ORGANIZATION_ID = 1;

function formatAmount(value: number, stablecoin: string): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${stablecoin}`;
}

function isLikelyStellarAddress(value: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(value.trim());
}

function buildConicGradient(allocations: RevenueAllocation[]): string {
  if (allocations.length === 0) return 'conic-gradient(#3f3f46 0% 100%)';
  const palette = ['#22c55e', '#06b6d4', '#f59e0b', '#a855f7', '#ef4444', '#84cc16'];
  let start = 0;
  const slices = allocations.map((entry, index) => {
    const end = start + entry.percentage;
    const segment = `${palette[index % palette.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${slices.join(',')})`;
}

export default function RevenueSplitDashboard() {
  const [allocations, setAllocations] = useState<RevenueAllocation[]>([]);
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { address, connect } = useWallet();
  const { sign } = useWalletSigning();
  const { notifyError, notifySuccess } = useNotification();

  const preferredStablecoin = (
    localStorage.getItem('preferredStablecoin') ||
    import.meta.env.VITE_PREFERRED_STABLECOIN ||
    'USDC'
  ).toUpperCase();

  const totalAllocation = useMemo(
    () =>
      allocations.reduce(
        (sum, entry) => sum + (Number.isFinite(entry.percentage) ? entry.percentage : 0),
        0
      ),
    [allocations]
  );

  const recipientBalances = useMemo(() => {
    const byRecipient = new Map<string, number>();
    events.forEach((event) => {
      if (!Number.isFinite(event.amount)) return;
      byRecipient.set(
        event.recipientLabel,
        (byRecipient.get(event.recipientLabel) || 0) + event.amount
      );
    });
    return [...byRecipient.entries()].map(([recipient, amount]) => ({ recipient, amount }));
  }, [events]);

  const totalDistributed = useMemo(
    () =>
      events.reduce((sum, event) => sum + (Number.isFinite(event.amount) ? event.amount : 0), 0),
    [events]
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await contractService.initialize();
        const contractId =
          contractService.getContractId('revenue_split', 'testnet') ||
          (import.meta.env.VITE_REVENUE_SPLIT_CONTRACT_ID as string | undefined);

        if (!contractId) {
          throw new Error('Revenue split contract ID is unavailable.');
        }

        if (!address) {
          setAllocations([]);
        } else {
          const contractAllocations = await fetchRevenueSplitAllocations(contractId, address);
          setAllocations(contractAllocations);
        }

        const distributionEvents = await fetchDistributionEvents(ORGANIZATION_ID, 1, 50);
        setEvents(distributionEvents);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load dashboard';
        setError(message);
        notifyError('Revenue split load failed', message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [address, notifyError]);

  const setAllocationField = (index: number, field: 'recipient' | 'percentage', value: string) => {
    setAllocations((prev) =>
      prev.map((entry, idx) =>
        idx === index
          ? {
              ...entry,
              [field]: field === 'percentage' ? Number.parseFloat(value || '0') : value,
            }
          : entry
      )
    );
  };

  const addRecipient = () => {
    setAllocations((prev) => [...prev, { recipient: '', percentage: 0 }]);
  };

  const removeRecipient = (index: number) => {
    setAllocations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveAllocations = async () => {
    if (!address) {
      notifyError('Wallet required', 'Connect a wallet before updating allocations.');
      return;
    }

    const hasInvalidAddress = allocations.some((entry) => !isLikelyStellarAddress(entry.recipient));
    if (hasInvalidAddress) {
      notifyError(
        'Invalid recipient',
        'Each allocation recipient must be a valid Stellar address.'
      );
      return;
    }

    if (Math.abs(totalAllocation - 100) > 0.0001) {
      notifyError(
        'Invalid allocation total',
        `Allocation total must equal 100%. Current total: ${totalAllocation.toFixed(2)}%.`
      );
      return;
    }

    setIsSaving(true);
    try {
      await contractService.initialize();
      const contractId =
        contractService.getContractId('revenue_split', 'testnet') ||
        (import.meta.env.VITE_REVENUE_SPLIT_CONTRACT_ID as string | undefined);
      if (!contractId) {
        throw new Error('Revenue split contract ID is unavailable.');
      }

      const { txHash } = await updateRevenueAllocations({
        contractId,
        sourceAddress: address,
        allocations,
        signTransaction: sign,
      });

      notifySuccess('Allocations updated', `Submitted on-chain update transaction: ${txHash}`);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Failed to update allocations';
      notifyError('Allocation update failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 lg:p-12 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            Revenue Split <span className="text-accent">Dashboard</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm tracking-wider uppercase mt-2">
            Contract-backed allocations and distribution history
          </p>
        </div>
        {!address ? (
          <button
            type="button"
            onClick={() => {
              void connect();
            }}
            className="px-4 py-2 rounded-lg font-bold bg-accent text-black"
          >
            Connect Wallet
          </button>
        ) : (
          <span className="text-xs text-zinc-400 font-mono">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-400 mb-6">Loading revenue split dashboard...</p>
      ) : null}
      {error ? <p className="text-sm text-red-400 mb-6">{error}</p> : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="card glass noise xl:col-span-1">
          <h2 className="text-lg font-bold mb-4">Current Allocation Splits</h2>
          <div className="flex items-center gap-6">
            <div
              className="w-44 h-44 rounded-full border border-zinc-700"
              style={{ background: buildConicGradient(allocations) }}
            />
            <div className="space-y-2">
              {allocations.length === 0 ? (
                <p className="text-sm text-zinc-400">No allocation data loaded.</p>
              ) : (
                allocations.map((entry, index) => (
                  <p key={`${entry.recipient}-${index}`} className="text-xs text-zinc-300">
                    {entry.recipient.slice(0, 6)}...{entry.recipient.slice(-4)} -{' '}
                    <span className="font-bold text-white">{entry.percentage.toFixed(2)}%</span>
                  </p>
                ))
              )}
              <p
                className={`text-sm font-bold ${Math.abs(totalAllocation - 100) <= 0.0001 ? 'text-green-400' : 'text-red-400'}`}
              >
                Total: {totalAllocation.toFixed(2)}%
              </p>
            </div>
          </div>
        </section>

        <section className="card glass noise xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Edit Allocations</h2>
            <button
              type="button"
              onClick={addRecipient}
              className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold"
            >
              Add Recipient
            </button>
          </div>

          <div className="space-y-3">
            {allocations.map((entry, index) => (
              <div
                key={`${entry.recipient}-${index}`}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
              >
                <input
                  type="text"
                  value={entry.recipient}
                  onChange={(event) => setAllocationField(index, 'recipient', event.target.value)}
                  placeholder="Recipient Stellar Address"
                  className="md:col-span-8 bg-[#0a0a0c] border border-zinc-800 rounded-lg px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  value={Number.isFinite(entry.percentage) ? entry.percentage : 0}
                  onChange={(event) => setAllocationField(index, 'percentage', event.target.value)}
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="%"
                  className="md:col-span-3 bg-[#0a0a0c] border border-zinc-800 rounded-lg px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeRecipient(index)}
                  className="md:col-span-1 text-red-400 text-xs font-semibold"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-zinc-400">Total allocation must be exactly 100%.</p>
            <button
              type="button"
              onClick={() => {
                void handleSaveAllocations();
              }}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-accent text-black font-bold disabled:opacity-70"
            >
              {isSaving ? 'Submitting...' : 'Submit On-Chain Update'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <section className="card glass noise xl:col-span-1">
          <h2 className="text-lg font-bold mb-4">Live Recipient Balances</h2>
          {recipientBalances.length === 0 ? (
            <p className="text-sm text-zinc-400">No recipient distributions available yet.</p>
          ) : (
            <div className="space-y-2">
              {recipientBalances.map((row) => (
                <div
                  key={row.recipient}
                  className="flex items-center justify-between border-b border-zinc-800 pb-2"
                >
                  <span className="text-xs text-zinc-300 truncate max-w-[180px]">
                    {row.recipient}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {formatAmount(row.amount, preferredStablecoin)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-zinc-200">
            Total Distributed:{' '}
            <span className="font-bold">{formatAmount(totalDistributed, preferredStablecoin)}</span>
          </p>
        </section>

        <section className="card glass noise xl:col-span-2">
          <h2 className="text-lg font-bold mb-4">Historical Distribution Events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-400">No backend indexed distribution events found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Recipient</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-zinc-800/50">
                      <td className="py-2 pr-4 text-xs">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-xs">{event.recipientLabel}</td>
                      <td className="py-2 pr-4 text-xs">{event.action}</td>
                      <td className="py-2 pr-4 text-xs">
                        {formatAmount(event.amount, event.assetCode || preferredStablecoin)}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {event.txHash ? (
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent"
                          >
                            {event.txHash.slice(0, 10)}...
                          </a>
                        ) : (
                          <span className="text-zinc-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
