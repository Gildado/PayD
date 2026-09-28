import { useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { ContractMetric, ContractMetrics } from '../hooks/useContractMetrics';

// ── Sub-components ────────────────────────────────────────────────────────────

interface MetricRowProps {
  metric: ContractMetric;
}

function MetricRow({ metric }: MetricRowProps) {
  const prefersReducedMotion = useReducedMotion();
  const previousValueRef = useRef(metric.value);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    if (previousValueRef.current === metric.value) return;
    previousValueRef.current = metric.value;
    if (prefersReducedMotion) return;
    setJustUpdated(true);
    const timeout = setTimeout(() => setJustUpdated(false), 1200);
    return () => clearTimeout(timeout);
  }, [metric.value, prefersReducedMotion]);

  const statusIcon = {
    ok: <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />,
    warn: <AlertCircle className="h-3.5 w-3.5 text-amber-400" aria-hidden />,
    error: <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden />,
    loading: (
      <Loader2
        className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none text-muted"
        aria-hidden
      />
    ),
  }[metric.status];

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/60 last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {statusIcon}
        {metric.label}
      </span>
      <span
        className={`text-xs font-mono font-semibold ${justUpdated ? 'status-flash' : ''} ${
          metric.status === 'error'
            ? 'text-danger'
            : metric.status === 'warn'
              ? 'text-amber-400'
              : 'text-text'
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
    <div className="rounded-xl border border-border bg-surface/50 p-4 transition-colors duration-200 hover:border-hi hover:bg-surface/70">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">{title}</p>
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
  const { t, i18n } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  return (
    <section aria-label={t('contractMetrics.ariaLabel')} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-sm font-bold tracking-tight">{t('contractMetrics.title')}</h2>
        </div>
        <div className="flex items-center gap-3">
          {metrics.lastRefreshed ? (
            <span className="text-[11px] text-muted">
              {t('contractMetrics.updated', {
                time: metrics.lastRefreshed.toLocaleTimeString(i18n.language),
              })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label={t('contractMetrics.refreshAriaLabel')}
            className="rounded-md p-1.5 text-muted hover:bg-surface-hi hover:text-text disabled:opacity-40 transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'motion-safe:animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error ? (
          <motion.div
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {error}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.25,
            delay: prefersReducedMotion ? 0 : 0,
          }}
        >
          <ContractCard
            title={t('contractMetrics.bulkPayment')}
            metrics={[
              metrics.bulk_payment.batchCount,
              metrics.bulk_payment.sequence,
              metrics.bulk_payment.isPaused,
            ]}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.25,
            delay: prefersReducedMotion ? 0 : 0.05,
          }}
        >
          <ContractCard
            title={t('contractMetrics.revenueSplit')}
            metrics={[
              metrics.revenue_split.distributionCount,
              metrics.revenue_split.totalDistributed,
              metrics.revenue_split.isPaused,
            ]}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.25,
            delay: prefersReducedMotion ? 0 : 0.1,
          }}
        >
          <ContractCard
            title={t('contractMetrics.vestingEscrow')}
            metrics={[
              metrics.vesting_escrow.isActive,
              metrics.vesting_escrow.vestedAmount,
              metrics.vesting_escrow.claimableAmount,
            ]}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.25,
            delay: prefersReducedMotion ? 0 : 0.15,
          }}
        >
          <ContractCard
            title={t('contractMetrics.crossAssetPayment')}
            metrics={[
              metrics.cross_asset_payment.paymentCount,
              metrics.cross_asset_payment.pendingAdmin,
            ]}
          />
        </motion.div>
      </div>
    </section>
  );
}
