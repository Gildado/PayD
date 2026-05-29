import { Activity, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { ContractMetric, ContractMetrics } from '../hooks/useContractMetrics';

// ── Sub-components ────────────────────────────────────────────────────────────

interface MetricRowProps {
  metric: ContractMetric;
}

function MetricRow({ metric }: MetricRowProps) {
  const statusIcon = {
    ok: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />,
    warn: <AlertCircle className="h-3.5 w-3.5 text-amber-400" aria-hidden />,
    error: <AlertCircle className="h-3.5 w-3.5 text-red-400" aria-hidden />,
    loading: <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" aria-hidden />,
  }[metric.status];

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
        {statusIcon}
        {metric.label}
      </span>
      <span
        className={`text-xs font-mono font-semibold ${
          metric.status === 'error'
            ? 'text-red-400'
            : metric.status === 'warn'
              ? 'text-amber-400'
              : 'text-white'
        }`}
      >
        {metric.value}
        {metric.unit ? ` ${metric.unit}` : ''}
      </span>
    </div>
  );
}

interface ContractCardProps {
  title: string;
  metrics: ContractMetric[];
}

function ContractCard({ title, metrics }: ContractCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</p>
      {metrics.map((m) => (
        <MetricRow key={m.label} metric={m} />
      ))}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface ContractMetricsPanelProps {
  metrics: ContractMetrics;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

/**
 * Displays a read-only dashboard of live on-chain metrics for all deployed
 * PayD Soroban contracts. Intended to be embedded in admin or analytics views.
 *
 * - Bulk Payment: batch count, pause state, sequence number
 * - Revenue Split: distribution count, pause state
 * - Vesting Escrow: vested / claimable amounts, active state
 * - Cross-Asset Payment: payment count, pending admin transfer
 */
export function ContractMetricsPanel({
  metrics,
  isLoading,
  error,
  onRefresh,
}: ContractMetricsPanelProps) {
  return (
    <section aria-label="On-chain contract metrics" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-sm font-bold tracking-tight">Contract Metrics</h2>
        </div>
        <div className="flex items-center gap-3">
          {metrics.lastRefreshed ? (
            <span className="text-[11px] text-zinc-500">
              Updated {metrics.lastRefreshed.toLocaleTimeString()}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh contract metrics"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-400"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ContractCard
          title="Bulk Payment"
          metrics={[
            metrics.bulk_payment.batchCount,
            metrics.bulk_payment.sequence,
            metrics.bulk_payment.isPaused,
          ]}
        />
        <ContractCard
          title="Revenue Split"
          metrics={[
            metrics.revenue_split.distributionCount,
            metrics.revenue_split.totalDistributed,
            metrics.revenue_split.isPaused,
          ]}
        />
        <ContractCard
          title="Vesting Escrow"
          metrics={[
            metrics.vesting_escrow.isActive,
            metrics.vesting_escrow.vestedAmount,
            metrics.vesting_escrow.claimableAmount,
          ]}
        />
        <ContractCard
          title="Cross-Asset Payment"
          metrics={[
            metrics.cross_asset_payment.paymentCount,
            metrics.cross_asset_payment.pendingAdmin,
          ]}
        />
      </div>
    </section>
  );
}
