import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  Clock,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Gift,
  Loader2,
  Calendar,
  Lock,
} from 'lucide-react';
import { Button, Card } from '@stellar/design-system';
import { useNotification } from '../hooks/useNotification';
import { useWallet } from '../hooks/useWallet';
import { useSorobanContract } from '../hooks/useSorobanContract';
import { contractService } from '../services/contracts';
import {
  fetchVestingConfig,
  fetchVestingProgress,
  type VestingConfig,
  type VestingProgress,
} from '../services/vestingEscrow';

function formatAmount(value: string): string {
  const n = Number(value);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

function formatTime(unixSeconds: number): string {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border-hi)] bg-black/10 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[var(--muted)]">{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
      </div>
      <p className={`mt-1 text-xl font-black ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{value}</p>
    </div>
  );
}

export default function VestingManagement() {
  const { t } = useTranslation();
  const { address, connect, requireWallet } = useWallet();
  const { notifyError, notifyPaymentSuccess, notifyPaymentFailure } = useNotification();

  const [config, setConfig] = React.useState<VestingConfig | null>(null);
  const [progress, setProgress] = React.useState<VestingProgress | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [contractId, setContractId] = React.useState<string | null>(null);

  const soroban = useSorobanContract(contractId ?? '');

  const progressPercent = progress && progress.total !== '0'
    ? Math.min(100, Math.round((Number(progress.vested) / Number(progress.total)) * 100))
    : 0;

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await contractService.initialize();
      const id = contractService.getContractId('vesting_escrow', 'testnet')
        || (import.meta.env.VITE_VESTING_CONTRACT_ID as string | undefined)
        || null;
      setContractId(id);
      if (!id) {
        setError('Vesting escrow contract ID is unavailable.');
        setIsLoading(false);
        return;
      }
      const [cfg, prog] = await Promise.all([
        fetchVestingConfig(id),
        fetchVestingProgress(id),
      ]);
      setConfig(cfg);
      setProgress(prog);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load vesting data';
      setError(msg);
      notifyError('Vesting load failed', msg);
    } finally {
      setIsLoading(false);
    }
  }, [notifyError]);

  React.useEffect(() => { void loadData(); }, [loadData]);

  const handleClaim = async () => {
    const walletAddress = await requireWallet();
    if (!walletAddress) return;
    if (!contractId) {
      notifyError('No contract', 'Vesting contract ID not configured.');
      return;
    }
    setIsClaiming(true);
    try {
      const result = await soroban.invoke({
        method: 'claim',
        args: [],
        parseResult: () => null,
      });
      notifyPaymentSuccess(result.txHash, 'Vesting claim');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Claim failed';
      notifyPaymentFailure(msg);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      {/* Header */}
      <section className="grid gap-6 rounded-[2rem] border border-[var(--border-hi)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-6 shadow-2xl shadow-black/10 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:p-8">
        <div className="space-y-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
            <Gift className="h-3.5 w-3.5" aria-hidden />
            Vesting operations
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Vesting <span className="text-accent">Escrow</span>
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              Manage vesting schedules, track vested amounts, and execute on-chain claims
              against the deployed vesting escrow contract.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!address ? (
              <button
                type="button"
                onClick={() => { void connect(); }}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black"
              >
                {t('revenueSplitDashboard.connectWallet')}
              </button>
            ) : (
              <span className="rounded-xl border border-[var(--border-hi)] bg-black/10 px-4 py-2.5 font-mono text-xs text-[var(--muted)]">
                Connected: {shortAddress(address)}
              </span>
            )}
            <button
              type="button"
              onClick={() => { void loadData(); }}
              disabled={isLoading}
              className="rounded-xl border border-[var(--border-hi)] bg-black/10 px-4 py-2.5 text-xs font-semibold hover:bg-white/5 disabled:opacity-40"
              aria-label="Refresh vesting data"
            >
              <RefreshCw className={`inline h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Progress"
            value={progress ? `${progressPercent}%` : '—'}
            accent
          />
          <StatCard
            icon={<Gift className="h-4 w-4" />}
            label="Vested"
            value={progress ? formatAmount(progress.vested) : '—'}
          />
          <StatCard
            icon={<Lock className="h-4 w-4" />}
            label="Total"
            value={progress ? formatAmount(progress.total) : '—'}
          />
          <StatCard
            icon={<Wallet className="h-4 w-4" />}
            label="Claimable"
            value={progress ? formatAmount(progress.claimable) : '—'}
            accent={progress ? Number(progress.claimable) > 0 : false}
          />
        </div>
      </section>

      {/* Error banner */}
      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      {/* Loading skeleton */}
      {isLoading && !error ? (
        <div className="space-y-4" aria-label="Loading vesting data" role="status">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card glass noise rounded-[1.5rem] p-4 space-y-3">
              <div className="h-4 w-1/3 bg-zinc-800 rounded animate-pulse" />
              <div className="h-8 w-full bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="card glass noise rounded-[1.5rem] p-4 space-y-3">
              <div className="h-4 w-1/3 bg-zinc-800 rounded animate-pulse" />
              <div className="h-8 w-full bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Content grid */}
      {config && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Vesting config card */}
          <section className="card glass noise xl:col-span-1 rounded-[1.5rem]">
            <h2 className="mb-4 text-lg font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              Vesting Config
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[var(--border-hi)] pb-2">
                <span className="text-xs text-[var(--muted)]">Admin</span>
                <span className="text-xs font-mono text-[var(--text)]">{shortAddress(config.admin)}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-hi)] pb-2">
                <span className="text-xs text-[var(--muted)]">Beneficiary</span>
                <span className="text-xs font-mono text-[var(--text)]">{shortAddress(config.beneficiary)}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-hi)] pb-2">
                <span className="text-xs text-[var(--muted)]">Total Amount</span>
                <span className="text-xs font-bold text-[var(--text)]">{formatAmount(config.totalAmount)}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-hi)] pb-2">
                <span className="text-xs text-[var(--muted)]">Start</span>
                <span className="text-xs text-[var(--text)]">{formatTime(config.startTime)}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-hi)] pb-2">
                <span className="text-xs text-[var(--muted)]">Cliff (days)</span>
                <span className="text-xs font-mono text-[var(--text)]">{Math.round(config.cliffDuration / 86400)}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-xs text-[var(--muted)]">Duration (days)</span>
                <span className="text-xs font-mono text-[var(--text)]">{Math.round(config.duration / 86400)}</span>
              </div>
            </div>
          </section>

          {/* Progress & claim card */}
          <section className="card glass noise xl:col-span-2 rounded-[1.5rem]">
            <h2 className="mb-4 text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              Vesting Progress
            </h2>

            {progress && (
              <div className="space-y-6">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-[var(--muted)] mb-2">
                    <span>Vested: {formatAmount(progress.vested)}</span>
                    <span>Total: {formatAmount(progress.total)}</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Vesting progress ${progressPercent}%`}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-[var(--muted)]">{progress.progressBps} bps</span>
                    <span className="text-[11px] font-bold text-[var(--accent)]">{progressPercent}%</span>
                  </div>
                </div>

                {/* Claim action */}
                <div className="rounded-2xl border border-[var(--border-hi)] bg-black/10 p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-[var(--text)]">
                        Claimable: <span className="text-[var(--accent)]">{formatAmount(progress.claimable)}</span>
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Executes an on-chain claim against the vesting escrow contract.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { void handleClaim(); }}
                      disabled={isClaiming || Number(progress.claimable) <= 0}
                      className="rounded-xl bg-accent px-5 py-2.5 font-bold text-black disabled:opacity-50 flex items-center gap-2"
                    >
                      {isClaiming ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Gift className="h-4 w-4" aria-hidden />
                      )}
                      {isClaiming ? 'Claiming...' : 'Claim'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!progress && !isLoading && (
              <p className="text-sm text-[var(--muted)]">
                No vesting data loaded. Make sure the contract ID is configured.
              </p>
            )}
          </section>
        </div>
      )}

      {!config && !isLoading && !error && (
        <Card>
          <div className="p-8 text-center space-y-4">
            <Calendar className="mx-auto h-10 w-10 text-[var(--muted)]" aria-hidden />
            <p className="text-sm text-[var(--muted)]">
              No vesting escrow contract configured. Set VITE_VESTING_CONTRACT_ID or deploy a contract first.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
