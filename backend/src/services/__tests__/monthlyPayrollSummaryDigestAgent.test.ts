/**
 * Tests for MonthlyPayrollSummaryDigestAgent
 */

import { jest, describe, it, expect } from '@jest/globals';
import { MonthlyPayrollSummaryDigestAgent } from '../monthlyPayrollSummaryDigestAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_ORG_ID,
  FIXTURE_MONTH,
  FIXTURE_REPORT_DATA,
  FIXTURE_EXPECTED,
} from './fixtures/monthlyPayrollSummaryFixture.js';

// Mock AdvancedReportService used by MonthlyPayrollSummaryDigestAgent
jest.mock('../advancedReportService.js', () => {
  return {
    AdvancedReportService: jest.fn().mockImplementation(() => ({
      generatePayrollSummary: jest.fn().mockResolvedValue(FIXTURE_REPORT_DATA),
    })),
  };
});

describe('MonthlyPayrollSummaryDigestAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = {} as unknown as Pool;
      const agent = new MonthlyPayrollSummaryDigestAgent(pool);
      await expect(agent.execute({} as any)).rejects.toThrow('organizationId is required');
    });

    it('returns correct monthly payroll summary digest structure and values', async () => {
      const pool = {} as unknown as Pool;
      const agent = new MonthlyPayrollSummaryDigestAgent(pool);

      const result = await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        month: FIXTURE_MONTH,
      });

      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);
      expect(result.metadata.agentId).toBe('monthly_payroll_summary_digest');

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe(FIXTURE_EXPECTED.schemaVersion);
      expect(report.organizationId).toBe(FIXTURE_EXPECTED.organizationId);
      expect(report.period).toBe(FIXTURE_EXPECTED.period);
      expect(report.summary.totalEmployeesPaid).toBe(FIXTURE_EXPECTED.totalEmployeesPaid);
      expect(report.summary.totalAmountTransacted).toBe(FIXTURE_EXPECTED.totalAmountTransacted);
      expect(report.summary.overallSuccessRate).toBe(FIXTURE_EXPECTED.overallSuccessRate);
      expect(report.byAsset).toHaveLength(FIXTURE_EXPECTED.assetCount);
      expect(report.byDepartment).toHaveLength(FIXTURE_EXPECTED.departmentCount);
      expect(report.anomaliesDetected).toHaveLength(FIXTURE_EXPECTED.anomalyCount);
    });

    it('defaults to current month when month is not provided', async () => {
      const pool = {} as unknown as Pool;
      const agent = new MonthlyPayrollSummaryDigestAgent(pool);

      const result = await agent.execute({
        organizationId: FIXTURE_ORG_ID,
      });

      const report = result.data![0] as any;
      expect(report.period).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = {} as unknown as Pool;
      const agent = new MonthlyPayrollSummaryDigestAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
