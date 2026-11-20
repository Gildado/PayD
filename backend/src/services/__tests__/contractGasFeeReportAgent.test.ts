/**
 * Tests for ContractGasFeeReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { ContractGasFeeReportAgent } from '../contractGasFeeReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/contractGasFeeFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('ContractGasFeeReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new ContractGasFeeReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary with total fees and transactions', async () => {
      const summaryRows = [{
        total_transactions: FIXTURE_EXPECTED.totalTransactions,
        total_fees: FIXTURE_EXPECTED.totalFees,
        avg_fee: FIXTURE_EXPECTED.avgFee,
        period_start: new Date('2024-03-08'),
        period_end: new Date('2024-03-15'),
      }];
      const typeRows = [
        { contract_type: 'payroll', transaction_count: 3, total_fees: 315, avg_fee: 105, min_fee: 100, max_fee: 110 },
      ];
      const trendRows: unknown[] = [];

      const pool = makePool([summaryRows, typeRows, trendRows]);
      const agent = new ContractGasFeeReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.totalTransactions).toBe(FIXTURE_EXPECTED.totalTransactions);
      expect(report.summary.totalFees).toBe(FIXTURE_EXPECTED.totalFees);
      expect(report.summary.avgFeePerTransaction).toBe(FIXTURE_EXPECTED.avgFee);
      expect(report.summary.totalFeeXLM).toBe(FIXTURE_EXPECTED.totalFeeXLM);
    });

    it('includes per-contract-type breakdown', async () => {
      const summaryRows = [{
        total_transactions: 8,
        total_fees: 855,
        avg_fee: 106.875,
        period_start: new Date('2024-03-08'),
        period_end: new Date('2024-03-15'),
      }];
      const typeRows = [
        { contract_type: 'payroll', transaction_count: 3, total_fees: 315, avg_fee: 105, min_fee: 100, max_fee: 110 },
        { contract_type: 'vesting', transaction_count: 2, total_fees: 390, avg_fee: 195, min_fee: 190, max_fee: 200 },
        { contract_type: 'trustline', transaction_count: 3, total_fees: 150, avg_fee: 50, min_fee: 45, max_fee: 55 },
      ];
      const trendRows: unknown[] = [];

      const pool = makePool([summaryRows, typeRows, trendRows]);
      const agent = new ContractGasFeeReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.byContractType).toHaveLength(3);
      expect(report.byContractType[0].contractType).toBe('payroll');
      expect(report.byContractType[0].totalFees).toBe(FIXTURE_EXPECTED.payroll.totalFees);
      expect(report.byContractType[0].avgFee).toBe(FIXTURE_EXPECTED.payroll.avgFee);
    });

    it('includes time-series trends', async () => {
      const summaryRows = [{ total_transactions: 8, total_fees: 855, avg_fee: 106.875, period_start: new Date(), period_end: new Date() }];
      const typeRows: unknown[] = [];
      const trendRows = [
        { period: new Date('2024-03-15'), transaction_count: 4, total_fees: 450, avg_fee: 112.5 },
        { period: new Date('2024-03-14'), transaction_count: 2, total_fees: 255, avg_fee: 127.5 },
        { period: new Date('2024-03-08'), transaction_count: 2, total_fees: 150, avg_fee: 75 },
      ];

      const pool = makePool([summaryRows, typeRows, trendRows]);
      const agent = new ContractGasFeeReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.trends).toHaveLength(3);
      expect(report.trends[0].period).toBe('2024-03-15');
      expect(report.trends[0].transactionCount).toBe(4);
    });

    it('generates recommendations based on fee data', async () => {
      const summaryRows = [{ total_transactions: 10, total_fees: 1500, avg_fee: 150, period_start: new Date(), period_end: new Date() }];
      const typeRows = [
        { contract_type: 'high-fee', transaction_count: 5, total_fees: 1200, avg_fee: 240, min_fee: 200, max_fee: 300 },
      ];
      const trendRows: unknown[] = [];

      const pool = makePool([summaryRows, typeRows, trendRows]);
      const agent = new ContractGasFeeReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.recommendations.length).toBeGreaterThan(0);
      // High avg fee should trigger warning
      const warningRec = report.recommendations.find((r: any) => r.type === 'warning');
      expect(warningRec).toBeDefined();
    });

    it('applies date filters when provided', async () => {
      const pool = makePool([[], [], []]);
      const agent = new ContractGasFeeReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('created_at >= $2');
      expect(sql).toContain('created_at <= $3');
    });

    it('applies contract type filter when provided', async () => {
      const pool = makePool([[], [], []]);
      const agent = new ContractGasFeeReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        contractType: 'payroll',
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('contract_type = $2');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new ContractGasFeeReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
