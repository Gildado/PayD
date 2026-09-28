/**
 * Tests for MonthlyPayrollSummaryDigestAgent
 */

import { jest, describe, it, expect } from '@jest/globals';
import { MonthlyPayrollSummaryDigestAgent } from '../monthlyPayrollSummaryDigestAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_ORG_ID,
  FIXTURE_MONTH,
  FIXTURE_SUMMARY_ROWS,
  FIXTURE_ASSET_ROWS,
  FIXTURE_DEPT_ROWS,
  FIXTURE_EXPECTED,
} from './fixtures/monthlyPayrollSummaryDigestFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] })
  );
  return { query: chain } as unknown as Pool;
}

describe('MonthlyPayrollSummaryDigestAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new MonthlyPayrollSummaryDigestAgent(pool);
      await expect(agent.execute({} as any)).rejects.toThrow('organizationId is required');
    });

    it('returns correct monthly digest with fixture dataset', async () => {
      const pool = makePool([FIXTURE_SUMMARY_ROWS, FIXTURE_ASSET_ROWS, FIXTURE_DEPT_ROWS]);
      const agent = new MonthlyPayrollSummaryDigestAgent(pool);

      const result = await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        month: FIXTURE_MONTH,
      });

      expect(result.format).toBe('JSON');
      expect(result.reportId).toBe('rpt-monthly-payroll-digest');
      expect(result.data).toHaveLength(1);

      const digest = result.data[0];
      expect(digest.schemaVersion).toBe('1.0');
      expect(digest.organizationId).toBe(FIXTURE_ORG_ID);
      expect(digest.period.year).toBe(2025);
      expect(digest.period.month).toBe(3);

      expect(digest.summary.totalPayrollRuns).toBe(FIXTURE_EXPECTED.totalPayrollRuns);
      expect(digest.summary.totalEmployeesPaid).toBe(FIXTURE_EXPECTED.totalEmployeesPaid);
      expect(digest.summary.successfulPaymentsCount).toBe(FIXTURE_EXPECTED.successfulPaymentsCount);
      expect(digest.summary.failedPaymentsCount).toBe(FIXTURE_EXPECTED.failedPaymentsCount);
      expect(digest.summary.totalDisbursedUsd).toBe(FIXTURE_EXPECTED.totalDisbursedUsd);
      expect(digest.summary.overallSuccessRate).toBe(FIXTURE_EXPECTED.overallSuccessRate);
      expect(digest.summary.avgPayoutPerEmployee).toBe(FIXTURE_EXPECTED.avgPayoutPerEmployee);

      expect(digest.assetBreakdown).toHaveLength(FIXTURE_EXPECTED.assetBreakdownCount);
      expect(digest.departmentBreakdown).toHaveLength(FIXTURE_EXPECTED.deptBreakdownCount);
      expect(digest.highlights.length).toBeGreaterThan(0);
    });

    it('handles empty data gracefully when no runs are found', async () => {
      const pool = makePool([[], [], []]);
      const agent = new MonthlyPayrollSummaryDigestAgent(pool);

      const result = await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        month: '2025-01',
      });

      expect(result.data).toHaveLength(1);
      const digest = result.data[0];
      expect(digest.summary.totalPayrollRuns).toBe(0);
      expect(digest.summary.totalEmployeesPaid).toBe(0);
      expect(digest.summary.totalDisbursedUsd).toBe('0.00');
      expect(digest.summary.overallSuccessRate).toBe(100);
    });
  });
});
