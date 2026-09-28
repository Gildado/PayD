import {
  defaultAggregateSummary,
  runReportBenchmark,
} from '../reportBenchmarkService.js';
import {
  buildSyntheticDataset,
  FIXTURE_EXPECTED,
  REPORT_FIXTURE_TRANSACTIONS,
} from './fixtures/reportAgentFixture.js';

describe('ReportBenchmarkService (#1340)', () => {
  it('aggregates the fixture dataset with known expected output', () => {
    const summary = defaultAggregateSummary(REPORT_FIXTURE_TRANSACTIONS) as {
      totalTransactions: number;
      successfulTransactions: number;
      failedTransactions: number;
      uniqueEmployees: number;
      totalsByAsset: Record<string, number>;
    };

    expect(summary.totalTransactions).toBe(FIXTURE_EXPECTED.totalTransactions);
    expect(summary.successfulTransactions).toBe(
      FIXTURE_EXPECTED.successfulTransactions
    );
    expect(summary.failedTransactions).toBe(FIXTURE_EXPECTED.failedTransactions);
    expect(summary.uniqueEmployees).toBe(FIXTURE_EXPECTED.uniqueEmployees);
    // Floating point-safe comparison against the pre-computed fixture totals.
    expect(summary.totalsByAsset['USDC'].toFixed(2)).toBe(
      FIXTURE_EXPECTED.totalAmountUsdc
    );
    expect(summary.totalsByAsset['EURC'].toFixed(2)).toBe(
      FIXTURE_EXPECTED.totalAmountEurc
    );
  });

  it('produces a valid benchmark report over a large synthetic org dataset', () => {
    const dataset = buildSyntheticDataset(50_000);
    const result = runReportBenchmark({
      dataset,
      iterations: 3,
      warnBudgetMs: 5_000,
      failBudgetMs: 10_000,
    });

    expect(result.schemaVersion).toBe('1.0');
    expect(result.datasetSize).toBe(50_000);
    expect(result.metrics.iterations).toBe(3);
    expect(result.metrics.minMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.maxMs).toBeGreaterThanOrEqual(result.metrics.minMs);
    expect(result.metrics.p95Ms).toBeGreaterThanOrEqual(result.metrics.maxMs);
    expect(result.metrics.rowsPerSecond).toBeGreaterThan(0);
    expect(['pass', 'warn', 'fail']).toContain(result.verdict);
  });

  it('classifies verdicts against budgets', () => {
    const dataset = REPORT_FIXTURE_TRANSACTIONS;

    const pass = runReportBenchmark({
      dataset,
      iterations: 2,
      warnBudgetMs: 60_000,
      failBudgetMs: 120_000,
    });
    expect(pass.verdict).toBe('pass');

    const warn = runReportBenchmark({
      dataset,
      iterations: 2,
      warnBudgetMs: -1, // any positive duration exceeds this
      failBudgetMs: 60_000,
    });
    expect(warn.verdict).toBe('warn');

    const fail = runReportBenchmark({
      dataset,
      iterations: 2,
      warnBudgetMs: -1,
      failBudgetMs: -1,
    });
    expect(fail.verdict).toBe('fail');
  });

  it('rejects invalid iteration counts', () => {
    expect(() =>
      runReportBenchmark({ dataset: REPORT_FIXTURE_TRANSACTIONS, iterations: 0 })
    ).toThrow('iterations must be a positive integer');
  });
});
