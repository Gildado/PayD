/**
 * Tests for TransactionAuditCorrelationReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { TransactionAuditCorrelationReportAgent } from '../transactionAuditCorrelationReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
} from './fixtures/transactionAuditCorrelationFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const query = jest.fn();
  resolvedRows.forEach((rows) => query.mockResolvedValueOnce({ rows }));
  query.mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool;
}

const summaryRows = [{
  total_records: FIXTURE_EXPECTED.totalRecords,
  successful: FIXTURE_EXPECTED.successful,
  failed: FIXTURE_EXPECTED.failed,
  unique_source_accounts: FIXTURE_EXPECTED.uniqueSourceAccounts,
  total_fees: String(FIXTURE_EXPECTED.totalFees),
  avg_fee: String(FIXTURE_EXPECTED.avgFee),
  min_fee: String(FIXTURE_EXPECTED.minFee),
  max_fee: String(FIXTURE_EXPECTED.maxFee),
  period_start: new Date('2024-04-01T00:00:00Z'),
  period_end: new Date('2024-04-03T00:00:00Z'),
}];

const sourceRows = [
  { source_account: 'GAAAA', transaction_count: 3, successful: 3, failed: 0, total_fees: '315' },
  { source_account: 'GBBBBB', transaction_count: 2, successful: 0, failed: 2, total_fees: '420' },
  { source_account: 'GCMIXED', transaction_count: 2, successful: 1, failed: 1, total_fees: '310' },
  { source_account: 'GDDDDD', transaction_count: 2, successful: 2, failed: 0, total_fees: '270' },
];

const statusRows = [
  { successful: true, count: 6 },
  { successful: false, count: 3 },
];

const trendRows = [
  { period: new Date('2024-04-03T00:00:00Z'), total: 3, successful: 2, failed: 1 },
  { period: new Date('2024-04-02T00:00:00Z'), total: 3, successful: 2, failed: 1 },
  { period: new Date('2024-04-01T00:00:00Z'), total: 3, successful: 2, failed: 1 },
];

const correlationRows = [
  { source_account: 'GCMIXED', transaction_count: 2, successful: 1, failed: 1 },
];

describe('TransactionAuditCorrelationReportAgent', () => {
  describe('execute()', () => {
    it('returns correct summary with outcome and fee stats', async () => {
      const pool = makePool([summaryRows, sourceRows, statusRows, trendRows, correlationRows]);
      const agent = new TransactionAuditCorrelationReportAgent(pool);

      const result = await agent.execute({ organizationId: 42 });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.totalRecords).toBe(FIXTURE_EXPECTED.totalRecords);
      expect(report.summary.successful).toBe(FIXTURE_EXPECTED.successful);
      expect(report.summary.failed).toBe(FIXTURE_EXPECTED.failed);
      expect(report.summary.successRate).toBe(FIXTURE_EXPECTED.successRate);
      expect(report.summary.uniqueSourceAccounts).toBe(FIXTURE_EXPECTED.uniqueSourceAccounts);
      expect(report.summary.totalFees).toBe(FIXTURE_EXPECTED.totalFees);
      expect(report.summary.avgFee).toBe(FIXTURE_EXPECTED.avgFee);
      expect(report.summary.minFee).toBe(FIXTURE_EXPECTED.minFee);
      expect(report.summary.maxFee).toBe(FIXTURE_EXPECTED.maxFee);
    });

    it('includes a per-source-account breakdown', async () => {
      const pool = makePool([summaryRows, sourceRows, statusRows, trendRows, correlationRows]);
      const agent = new TransactionAuditCorrelationReportAgent(pool);

      const result = await agent.execute({ organizationId: 42 });
      const report = result.data![0] as any;

      expect(report.bySourceAccount).toHaveLength(FIXTURE_EXPECTED.bySourceAccountLength);
      expect(report.bySourceAccount[0].sourceAccount).toBe(FIXTURE_EXPECTED.topSourceAccount);
      expect(report.bySourceAccount[0].transactionCount).toBe(3);
    });

    it('includes a status breakdown', async () => {
      const pool = makePool([summaryRows, sourceRows, statusRows, trendRows, correlationRows]);
      const agent = new TransactionAuditCorrelationReportAgent(pool);

      const result = await agent.execute({ organizationId: 42 });
      const report = result.data![0] as any;

      const success = report.statusBreakdown.find((s: any) => s.status === 'successful');
      const failed = report.statusBreakdown.find((s: any) => s.status === 'failed');
      expect(success.count).toBe(FIXTURE_EXPECTED.statusSuccessful);
      expect(failed.count).toBe(FIXTURE_EXPECTED.statusFailed);
    });

    it('includes daily audit trends', async () => {
      const pool = makePool([summaryRows, sourceRows, statusRows, trendRows, correlationRows]);
      const agent = new TransactionAuditCorrelationReportAgent(pool);

      const result = await agent.execute({ organizationId: 42 });
      const report = result.data![0] as any;

      expect(report.trends).toHaveLength(FIXTURE_EXPECTED.trendsLength);
      expect(report.trends[0].period).toBe('2024-04-03');
      expect(report.trends[0].total).toBe(3);
    });

    it('identifies mixed-outcome correlations', async () => {
      const pool = makePool([summaryRows, sourceRows, statusRows, trendRows, correlationRows]);
      const agent = new TransactionAuditCorrelationReportAgent(pool);

      const result = await agent.execute({ organizationId: 42 });
      const report = result.data![0] as any;

      expect(report.correlations).toHaveLength(FIXTURE_EXPECTED.correlationsLength);
      expect(report.correlations[0].sourceAccount).toBe(FIXTURE_EXPECTED.mixedSourceAccount);
      expect(report.correlations[0].mixedOutcomeRatio).toBe(FIXTURE_EXPECTED.mixedOutcomeRatio);
      expect(report.correlations[0].insight).toContain('GCMIXED');
    });

    it('applies an organization filter when provided', async () => {
      const pool = makePool([[], [], [], [], []]);
      const agent = new TransactionAuditCorrelationReportAgent(pool);

      await agent.execute({ organizationId: 7 });
      const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('source_account IN');
      expect(sql).toContain('organization_id = $1');
      expect(params[0]).toBe(7);
    });

    it('omits the organization filter when none is provided', async () => {
      const pool = makePool([[], [], [], [], []]);
      const agent = new TransactionAuditCorrelationReportAgent(pool);

      await agent.execute({});
      const [sql] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).not.toContain('organization_id');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new TransactionAuditCorrelationReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
