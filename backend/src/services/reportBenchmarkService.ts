/**
 * Report agent performance benchmarking service (#1340).
 *
 * Runs a report-generation function against a dataset repeatedly, measures
 * wall-clock timings and produces a machine-readable benchmark report with
 * percentile metrics plus a pass/warn/fail verdict against a per-run budget.
 *
 * See docs/REPORT_AGENT.md for the documented output schema.
 */

export interface BenchmarkOptions<T> {
  /** Dataset to benchmark against (fixture or synthetic large-org data). */
  dataset: T[];
  /** Number of timed runs (default 5). */
  iterations?: number;
  /** Per-run budget in ms; runs above `warnBudgetMs` are flagged. */
  warnBudgetMs?: number;
  /** Hard budget in ms; exceeding this fails the benchmark. */
  failBudgetMs?: number;
  /**
   * The report generation step under test. Defaults to a standard
   * aggregation summary (counts + per-asset totals), matching what the
   * payroll report agents compute.
   */
  generateReport?: (rows: T[]) => unknown;
}

export interface BenchmarkMetrics {
  iterations: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  rowsPerSecond: number;
}

export interface ReportBenchmarkResult {
  schemaVersion: '1.0';
  generatedAt: string;
  datasetSize: number;
  budget: { warnMs: number | null; failMs: number | null };
  verdict: 'pass' | 'warn' | 'fail';
  metrics: BenchmarkMetrics;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[Math.max(0, index)];
}

/** Default aggregation used when no custom generator is supplied. */
export function defaultAggregateSummary<T extends Record<string, unknown>>(
  rows: T[]
): Record<string, unknown> {
  let successful = 0;
  let failed = 0;
  const uniqueEmployees = new Set<string>();
  const totalsByAsset = new Map<string, number>();
  for (const row of rows) {
    if (row['successful'] === true) successful += 1;
    else failed += 1;
    const employeeId = row['employeeId'];
    if (typeof employeeId === 'string') uniqueEmployees.add(employeeId);
    const asset = String(row['assetCode'] ?? 'UNKNOWN');
    const amount = Number.parseFloat(String(row['amount'] ?? '0'));
    if (Number.isFinite(amount)) {
      totalsByAsset.set(asset, (totalsByAsset.get(asset) ?? 0) + amount);
    }
  }
  return {
    totalTransactions: rows.length,
    successfulTransactions: successful,
    failedTransactions: failed,
    uniqueEmployees: uniqueEmployees.size,
    totalsByAsset: Object.fromEntries(totalsByAsset),
  };
}

export function runReportBenchmark<T extends Record<string, unknown>>(
  options: BenchmarkOptions<T>
): ReportBenchmarkResult {
  const {
    dataset,
    iterations = 5,
    warnBudgetMs = null,
    failBudgetMs = null,
    generateReport = defaultAggregateSummary,
  } = options;

  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('iterations must be a positive integer');
  }

  // Warm-up run (not timed) so JIT/first-call costs don't skew iteration 1.
  generateReport(dataset);

  const durations: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    generateReport(dataset);
    durations.push(performance.now() - start);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const sum = durations.reduce((acc, value) => acc + value, 0);
  const mean = sum / iterations;
  const median =
    iterations % 2 === 1
      ? sorted[(iterations - 1) / 2]
      : (sorted[iterations / 2 - 1] + sorted[iterations / 2]) / 2;

  const metrics: BenchmarkMetrics = {
    iterations,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    meanMs: mean,
    medianMs: median,
    p95Ms: percentile(sorted, 95),
    rowsPerSecond:
      sum > 0 ? Math.round((dataset.length * iterations) / (sum / 1000)) : Infinity,
  };

  let verdict: 'pass' | 'warn' | 'fail' = 'pass';
  if (failBudgetMs !== null && metrics.p95Ms > failBudgetMs) {
    verdict = 'fail';
  } else if (warnBudgetMs !== null && metrics.p95Ms > warnBudgetMs) {
    verdict = 'warn';
  }

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    datasetSize: dataset.length,
    budget: { warnMs: warnBudgetMs, failMs: failBudgetMs },
    verdict,
    metrics,
  };
}
