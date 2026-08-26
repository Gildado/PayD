import { jest, describe, it, expect } from '@jest/globals';
import { BulkPaymentBatchReportAgent } from '../bulkPaymentBatchReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_BATCH_ROWS,
  FIXTURE_SUMMARY_ROW,
  FIXTURE_FAILURE_ROWS,
  FIXTURE_TREND_ROWS,
  FIXTURE_EXPECTED,
} from './fixtures/bulkPaymentBatchFixture.js';

function makePool(overrides: { batches?: unknown[]; summary?: unknown[]; failures?: unknown[]; trend?: unknown[] } = {}): Pool {
  const fn = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('GROUP BY DATE')) return Promise.resolve({ rows: overrides.trend ?? [] });
    if (sql.includes('bulk_payment_items') && sql.includes('status')) return Promise.resolve({ rows: overrides.failures ?? [] });
    if (sql.includes('COUNT(*)') && sql.includes('SUM')) return Promise.resolve({ rows: overrides.summary ?? [] });
    return Promise.resolve({ rows: overrides.batches ?? [] });
  });
  return { query: fn } as unknown as Pool;
}

describe('BulkPaymentBatchReportAgent', () => {
  describe('execute()', () => {
    it('returns correct summary totals', async () => {
      const pool = makePool({
        batches: FIXTURE_BATCH_ROWS,
        summary: [FIXTURE_SUMMARY_ROW],
        failures: FIXTURE_FAILURE_ROWS,
        trend: FIXTURE_TREND_ROWS,
      });
      const agent = new BulkPaymentBatchReportAgent(pool);

      const result = await agent.execute({});
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.totalBatches).toBe(FIXTURE_EXPECTED.totalBatches);
      expect(report.summary.totalItems).toBe(FIXTURE_EXPECTED.totalItems);
      expect(report.summary.successfulItems).toBe(FIXTURE_EXPECTED.successfulItems);
      expect(report.summary.failedItems).toBe(FIXTURE_EXPECTED.failedItems);
    });

    it('computes overall success rate correctly', async () => {
      const pool = makePool({
        batches: FIXTURE_BATCH_ROWS,
        summary: [FIXTURE_SUMMARY_ROW],
        failures: FIXTURE_FAILURE_ROWS,
        trend: FIXTURE_TREND_ROWS,
      });
      const agent = new BulkPaymentBatchReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.summary.overallSuccessRate).toBe(FIXTURE_EXPECTED.overallSuccessRate);
    });

    it('returns batch breakdown with per-batch success rates', async () => {
      const pool = makePool({
        batches: FIXTURE_BATCH_ROWS,
        summary: [FIXTURE_SUMMARY_ROW],
        failures: FIXTURE_FAILURE_ROWS,
        trend: FIXTURE_TREND_ROWS,
      });
      const agent = new BulkPaymentBatchReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.batchBreakdown).toHaveLength(3);
      const batch1 = report.batchBreakdown.find((b: any) => b.batchId === 'batch-1');
      expect(batch1.successRate).toBe(FIXTURE_EXPECTED.batch1SuccessRate);

      const batch2 = report.batchBreakdown.find((b: any) => b.batchId === 'batch-2');
      expect(batch2.successRate).toBe(FIXTURE_EXPECTED.batch2SuccessRate);
    });

    it('returns recent failures with error messages', async () => {
      const pool = makePool({
        batches: FIXTURE_BATCH_ROWS,
        summary: [FIXTURE_SUMMARY_ROW],
        failures: FIXTURE_FAILURE_ROWS,
        trend: FIXTURE_TREND_ROWS,
      });
      const agent = new BulkPaymentBatchReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.recentFailures).toHaveLength(FIXTURE_EXPECTED.failureCount);
      expect(report.recentFailures[0].errorMessage).toBe('insufficient balance');
    });

    it('returns success rate over time', async () => {
      const pool = makePool({
        batches: FIXTURE_BATCH_ROWS,
        summary: [FIXTURE_SUMMARY_ROW],
        failures: FIXTURE_FAILURE_ROWS,
        trend: FIXTURE_TREND_ROWS,
      });
      const agent = new BulkPaymentBatchReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.successRateOverTime).toHaveLength(3);
      expect(report.successRateOverTime[0].date).toBe('2024-06-03');
    });

    it('filters by organizationId when provided', async () => {
      const pool = makePool({ batches: [], summary: [FIXTURE_SUMMARY_ROW] });
      const agent = new BulkPaymentBatchReportAgent(pool);

      await agent.execute({ organizationId: 42 });

      const calls = (pool.query as jest.Mock).mock.calls.map(([sql]: [string]) => sql);
      const batchSql = calls.find((s: string) => s.includes('FROM bulk_payment_batches'));
      expect(batchSql).toContain('organization_id = $1');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new BulkPaymentBatchReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
