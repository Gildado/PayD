import { Registry, Gauge, Counter, Histogram } from 'prom-client';

/**
 * Centralized Prometheus metrics registry for PayD.
 * Used for observability, monitoring, and alerting.
 */

// Create a custom registry (do not use the default global registry)
export const metricsRegistry = new Registry();

// ============================================================================
// Ledger Lag Metrics
// ============================================================================

/**
 * Gauge: Current ledger lag in seconds (network ledger - last observed).
 * Updated periodically by ledgerObserverService.
 */
export const ledgerLagSeconds = new Gauge({
  name: 'payd_ledger_lag_seconds',
  help: 'Current lag between network latest ledger and last observed ledger in seconds',
  registers: [metricsRegistry],
  labelNames: ['network'],
});

/**
 * Gauge: Current ledger lag in block count.
 */
export const ledgerLagBlocks = new Gauge({
  name: 'payd_ledger_lag_blocks',
  help: 'Current lag between network latest ledger and last observed ledger in blocks',
  registers: [metricsRegistry],
  labelNames: ['network'],
});

/**
 * Gauge: Latest ledger sequence observed on network.
 */
export const networkLatestLedger = new Gauge({
  name: 'payd_network_latest_ledger',
  help: 'Latest ledger sequence reported by Horizon',
  registers: [metricsRegistry],
  labelNames: ['network'],
});

/**
 * Gauge: Latest ledger sequence observed by our service.
 */
export const observedLatestLedger = new Gauge({
  name: 'payd_observed_latest_ledger',
  help: 'Latest ledger sequence observed by ledger observer service',
  registers: [metricsRegistry],
  labelNames: ['network'],
});

// ============================================================================
// Payment Processing Metrics
// ============================================================================

/**
 * Counter: Total payment submissions (successful and failed).
 */
export const paymentSubmissions = new Counter({
  name: 'payd_payment_submissions_total',
  help: 'Total payment submissions',
  registers: [metricsRegistry],
  labelNames: ['status', 'asset_code'],
});

/**
 * Counter: Retry attempts by error type.
 */
export const retryAttempts = new Counter({
  name: 'payd_retry_attempts_total',
  help: 'Total retry attempts by error type',
  registers: [metricsRegistry],
  labelNames: ['error_type', 'action'],
});

/**
 * Counter: Fee bump operations.
 */
export const feeBumps = new Counter({
  name: 'payd_fee_bumps_total',
  help: 'Total fee bump operations',
  registers: [metricsRegistry],
  labelNames: ['reason'],
});

/**
 * Histogram: Payment submission latency in milliseconds.
 */
export const paymentLatency = new Histogram({
  name: 'payd_payment_latency_ms',
  help: 'Payment submission latency in milliseconds',
  registers: [metricsRegistry],
  labelNames: ['asset_code'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
});

// ============================================================================
// Error Metrics
// ============================================================================

/**
 * Counter: Horizon errors by type.
 */
export const horizonErrors = new Counter({
  name: 'payd_horizon_errors_total',
  help: 'Total Horizon errors by type',
  registers: [metricsRegistry],
  labelNames: ['error_type', 'retriable'],
});

/**
 * Gauge: Current circuit breaker state (0 = closed, 1 = open).
 */
export const circuitBreakerState = new Gauge({
  name: 'payd_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open)',
  registers: [metricsRegistry],
  labelNames: ['circuit_name'],
});

// ============================================================================
// Cache Metrics
// ============================================================================

/**
 * Counter: Cache hits and misses for trustline state.
 */
export const trustlineCacheHits = new Counter({
  name: 'payd_trustline_cache_hits_total',
  help: 'Trustline cache hits',
  registers: [metricsRegistry],
});

export const trustlineCacheMisses = new Counter({
  name: 'payd_trustline_cache_misses_total',
  help: 'Trustline cache misses',
  registers: [metricsRegistry],
});

/**
 * Counter: Trustline state cache invalidations.
 */
export const trustlineCacheInvalidations = new Counter({
  name: 'payd_trustline_cache_invalidations_total',
  help: 'Trustline cache invalidations',
  registers: [metricsRegistry],
  labelNames: ['reason'],
});

// ============================================================================
// Export registry for middleware integration
// ============================================================================

/**
 * Get current metrics in Prometheus exposition format.
 * Used by /metrics endpoint.
 */
export async function getMetricsOutput(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}
