import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { parseContractError, type ContractErrorDetail } from '../utils/contractErrorParser';
import { getTxExplorerUrl } from '../utils/stellarExpert';
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

const CHART_COLORS = ['#4af0b8', '#f59e0b', '#60a5fa', '#f97316', '#f43f5e', '#a78bfa'];

function formatAmount(value: number, stablecoin: string): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${stablecoin}`;
}

function isLikelyStellarAddress(value: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(value.trim());
}

function getPreferredStablecoin(): string {
  if (typeof localStorage === 'undefined') {
    return (
      (import.meta.env.VITE_PREFERRED_STABLECOIN as string | undefined) || 'USDC'
    ).toUpperCase();
  }

  return (
    localStorage.getItem('preferredStablecoin') ||
    (import.meta.env.VITE_PREFERRED_STABLECOIN as string | undefined) ||
    'USDC'
  ).toUpperCase();
}

function getReadSourceAddress(walletAddress: string | null): string | null {
  return walletAddress || (import.meta.env.VITE_SOROBAN_READ_SOURCE as string | undefined) || null;
}

function getOrgPublicKey(): string | null {
  if (typeof localStorage === 'undefined') {
    return (import.meta.env.VITE_ORG_PUBLIC_KEY as string | undefined) || null;
  }

  return (
    localStorage.getItem('orgPublicKey') ||
    localStorage.getItem('organizationPublicKey') ||
    (import.meta.env.VITE_ORG_PUBLIC_KEY as string | undefined) ||
    null
  );
}

export default function RevenueSplitDashboard() {
  const [allocations, setAllocations] = useState<(RevenueAllocation & { id: string })[]>([]);
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [contractError, setContractError] = useState<ContractErrorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { t } = useTranslation();
  const { address, connect, requireWallet } = useWallet();
  const { sign } = useWalletSigning();
  const { notifyError, notifyPaymentSuccess, notifyPaymentFailure, notifyApiError } =
    useNotification();

  const preferredStablecoin = getPreferredStablecoin();
  const readSourceAddress = getReadSourceAddress(address);
  const orgPublicKey = getOrgPublicKey();

  const totalAllocation = useMemo(
    () =>
      allocations.reduce(
        (sum, entry) => sum + (Number.isFinite(entry.percentage) ? entry.percentage : 0),
        0
      ),
    [allocations]
  );

  const isAllocationTotalValid = Math.abs(totalAllocation - 100) <= 0.0001;

  const chartData = useMemo(
    () =>
      allocations.map((entry, index) => ({
        ...entry,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })),
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

  const shortAddress = useMemo(
    () => (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''),
    [address]
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

        if (!readSourceAddress) {
          throw new Error('Connect a wallet or set VITE_SOROBAN_READ_SOURCE to load allocations.');
        }

        const [contractAllocations, distributionEvents] = await Promise.all([
          fetchRevenueSplitAllocations(contractId, readSourceAddress),
          fetchDistributionEvents({ orgPublicKey: orgPublicKey || undefined, page: 1, limit: 50 }),
        ]);

        setAllocations(
          contractAllocations.map((entry, index) => ({
            ...entry,
            id: `alloc-${index}-${entry.recipient}`,
          }))
        );
        setEvents(distributionEvents);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load dashboard';
        setError(message);
        notifyApiError('Revenue split load failed', message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [notifyApiError, orgPublicKey, readSourceAddress]);

  const setAllocationField = (index: number, field: 'recipient' | 'percentage', value: string) => {
    setAllocations((prev) =>
      prev.map((entry, idx) =>
        idx === index
          ? {
              ...entry,
              [field]: field === 'percentage' ? Number.parseFloat(value || '0') : value,
              id: field === 'recipient' ? `alloc-${index}-${value}` : entry.id,
            }
          : entry
      )
    );
  };

  const addRecipient = () => {
    setAllocations((prev) => [...prev, { recipient: '', percentage: 0, id: `new-${Date.now()}` }]);
  };

  const removeRecipient = (index: number) => {
    setAllocations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveAllocations = async () => {
    const walletAddress = await requireWallet();
    if (!walletAddress) {
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

    if (!isAllocationTotalValid) {
      notifyError(
        'Invalid allocation total',
        `Allocation total must equal 100%. Current total: ${totalAllocation.toFixed(2)}%.`
      );
      return;
    }

    setIsSaving(true);
    setContractError(null);
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
        sourceAddress: walletAddress,
        allocations,
        signTransaction: sign,
      });

      notifyPaymentSuccess(txHash, 'Allocations updated');
    } catch (saveError) {
      const parsed = parseContractError(
        undefined,
        saveError instanceof Error ? saveError.message : 'Failed to update allocations'
      );
      setContractError(parsed);
      notifyPaymentFailure(parsed.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="grid gap-6 rounded-[2rem] border border-[var(--border-hi)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-6 shadow-2xl shadow-black/10 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:p-8">
        <div className="space-y-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            Revenue operations
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              {t('revenueSplitDashboard.titlePrefix')}{' '}
              <span className="text-accent">{t('revenueSplitDashboard.titleHighlight')}</span>
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              {t('revenueSplitDashboard.subtitle')} Keep allocation visibility, payout history, and
              contract changes on one screen so finance and operators can stay in sync.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!address ? (
              <button
                type="button"
                onClick={() => {
                  void connect();
                }}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black"
              >
                {t('revenueSplitDashboard.connectWallet')}
              </button>
            ) : (
              <span className="rounded-xl border border-[var(--border-hi)] bg-black/10 px-4 py-2.5 font-mono text-xs text-[var(--muted)]">
                {t('revenueSplitDashboard.connected')}: {shortAddress}
              </span>
            )}
            <span className="rounded-xl border border-[var(--border-hi)] bg-black/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {preferredStablecoin} settled
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-hi)] bg-black/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Allocation total
            </p>
            <p
              className={`mt-2 text-2xl font-black ${isAllocationTotalValid ? 'text-[var(--accent)]' : 'text-red-400'}`}
            >
              {totalAllocation.toFixed(2)}%
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {isAllocationTotalValid
                ? 'Balanced and ready to submit.'
                : 'Adjust entries to hit 100%.'}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-hi)] bg-black/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Allocation rows
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--text)]">{allocations.length}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Recipients currently configured.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-hi)] bg-black/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Distributed
            </p>
            <p className="mt-2 text-xl font-black text-[var(--text)]">
              {formatAmount(totalDistributed, preferredStablecoin)}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">Tracked from indexed payout events.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-hi)] bg-black/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">
              Events
            </p>
            <p className="mt-2 text-2xl font-black text-[var(--text)]">{events.length}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Recent distribution history loaded.</p>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-4" aria-label="Loading revenue split dashboard" role="status">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="card glass noise xl:col-span-1 space-y-3 rounded-[1.5rem] p-4">
              <SkeletonLoader variant="text" width="1/2" />
              <SkeletonLoader variant="chart" height={256} />
              <SkeletonLoader variant="text" count={3} />
            </div>
            <div className="card glass noise xl:col-span-2 space-y-3 rounded-[1.5rem] p-4">
              <SkeletonLoader variant="text" width="1/3" />
              <SkeletonLoader variant="card" count={3} height={12} />
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card glass noise xl:col-span-1 rounded-[1.5rem]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t('revenueSplitDashboard.currentAllocations')}</h2>
            <span className="rounded-full border border-[var(--border-hi)] px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">
              On-chain
            </span>
          </div>

          {chartData.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No allocation data loaded.</p>
          ) : (
            <div className="space-y-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="percentage"
                      nameKey="recipient"
                      innerRadius={72}
                      outerRadius={104}
                      paddingAngle={2}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(
                        value: number | string | readonly (number | string)[] | undefined
                      ) => `${Number(Array.isArray(value) ? value[0] : (value ?? 0)).toFixed(2)}%`}
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {chartData.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-hi)] bg-black/10 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="font-mono text-zinc-300">
                        {entry.recipient.slice(0, 6)}...{entry.recipient.slice(-4)}
                      </span>
                    </div>
                    <span className="font-bold text-white">{entry.percentage.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p
            className={`mt-4 text-sm font-bold ${isAllocationTotalValid ? 'text-green-400' : 'text-red-400'}`}
          >
            Total: {totalAllocation.toFixed(2)}%
          </p>
        </section>

        <section className="card glass noise xl:col-span-2 rounded-[1.5rem]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t('revenueSplitDashboard.editAllocations')}</h2>
            <button
              type="button"
              onClick={addRecipient}
              className="rounded-xl border border-[var(--border-hi)] bg-black/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
            >
              Add Recipient
            </button>
          </div>

          <div className="space-y-3">
            {allocations.map((entry, index) => (
              <div key={entry.id} className="grid grid-cols-1 items-center gap-3 md:grid-cols-12">
                <input
                  type="text"
                  value={entry.recipient}
                  onChange={(event) => setAllocationField(index, 'recipient', event.target.value)}
                  placeholder="Recipient Stellar Address"
                  className="rounded-xl border border-[var(--border-hi)] bg-black/10 px-3 py-2 text-xs md:col-span-8"
                />
                <input
                  type="number"
                  value={Number.isFinite(entry.percentage) ? entry.percentage : 0}
                  onChange={(event) => setAllocationField(index, 'percentage', event.target.value)}
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="%"
                  className="rounded-xl border border-[var(--border-hi)] bg-black/10 px-3 py-2 text-xs md:col-span-3"
                />
                <button
                  type="button"
                  onClick={() => removeRecipient(index)}
                  className="text-xs font-semibold text-red-400 md:col-span-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-zinc-300">
              <p>Total allocation must be exactly 100%.</p>
              <p>Submission uses a signed contract call only after simulation passes.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleSaveAllocations();
              }}
              disabled={isSaving || !isAllocationTotalValid}
              className="rounded-xl bg-accent px-4 py-2 font-bold text-black disabled:opacity-70"
            >
              {isSaving
                ? t('revenueSplitDashboard.submitting')
                : t('revenueSplitDashboard.editAllocations')}
            </button>
          </div>

          <ContractErrorPanel error={contractError} onClear={() => setContractError(null)} />
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card glass noise xl:col-span-1 rounded-[1.5rem]">
          <h2 className="mb-4 text-lg font-bold">{t('revenueSplitDashboard.liveBalances')}</h2>
          {recipientBalances.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No recipient distributions available yet.</p>
          ) : (
            <div className="space-y-2">
              {recipientBalances.map((row) => (
                <div
                  key={row.recipient}
                  className="flex items-center justify-between border-b border-[var(--border-hi)] pb-2"
                >
                  <span className="max-w-[180px] truncate text-xs text-[var(--muted)]">
                    {row.recipient}
                  </span>
                  <span className="text-xs font-bold text-[var(--text)]">
                    {formatAmount(row.amount, preferredStablecoin)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-[var(--text)]">
            Total Distributed:{' '}
            <span className="font-bold">{formatAmount(totalDistributed, preferredStablecoin)}</span>
          </p>
        </section>

        <section className="card glass noise xl:col-span-2 rounded-[1.5rem]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t('revenueSplitDashboard.historicalEvents')}</h2>
            {orgPublicKey ? (
              <span className="font-mono text-[11px] text-[var(--muted)]">
                Org: {orgPublicKey.slice(0, 6)}...{orgPublicKey.slice(-4)}
              </span>
            ) : null}
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No backend indexed distribution events found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--border-hi)] text-left text-[var(--muted)]">
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
                    <tr key={event.id} className="border-b border-[var(--border-hi)]">
                      <td className="py-2 pr-4 text-xs">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-xs">{event.recipientLabel}</td>
                      <td className="py-2 pr-4 text-xs capitalize">{event.action}</td>
                      <td className="py-2 pr-4 text-xs">
                        {formatAmount(event.amount, event.assetCode || preferredStablecoin)}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {event.txHash ? (
                          <a
                            href={getTxExplorerUrl(event.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent"
                          >
                            {event.txHash.slice(0, 10)}...
                          </a>
                        ) : (
                          <span className="text-zinc-300">N/A</span>
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
