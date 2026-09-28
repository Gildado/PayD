/**
 * Tests for FeeEstimationAccuracyReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { FeeEstimationAccuracyReportAgent } from '../feeEstimationAccuracyReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/feeEstimationAccuracyFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('FeeEstimationAccuracyReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new FeeEstimationAccuracyReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary with accuracy metrics', async () => {
      const summaryRows = [{
        total_estimations: FIXTURE_EXPECTED.totalEstimations,
        avg_error: FIXTURE_EXPECTED.avgError,
        avg_error_percent: 15.5,
        overestimated: FIXTURE_EXPECTED.overestimated,
        underestimated: FIXTURE_EXPECTED.underestimated,
        accurate: FIXTURE_EXPECTED.accurate,
      }];
      const bucketRows: unknown[] = [];
      const deviationRows: unknown[] = [];

      const pool = makePool([summaryRows, bucketRows, deviationRows]);
      const agent = new FeeEstimationAccuracyReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.totalEstimations).toBe(FIXTURE_EXPECTED.totalEstimations);
      expect(report.summary.accuracyRate).toBe(FIXTURE_EXPECTED.accuracyRate);
      expect(report.summary.avgEstimationError).toBe(FIXTURE_EXPECTED.avgError);
      expect(report.summary.totalOverestimated).toBe(FIXTURE_EXPECTED.overestimated);
      expect(report.summary.totalUnderestimated).toBe(FIXTURE_EXPECTED.underestimated);
      expect(report.summary.totalAccurate).toBe(FIXTURE_EXPECTED.accurate);
    });

    it('includes accuracy buckets distribution', async () => {
      const summaryRows = [{
        total_estimations: 8,
        avg_error: 28.625,
        avg_error_percent: 15.5,
        overestimated: 2,
        underestimated: 5,
        accurate: 3,
      }];
      const bucketRows = [
        { bucket: 'excellent', count: 3 },
        { bucket: 'good', count: 2 },
        { bucket: 'fair', count: 1 },
        { bucket: 'poor', count: 2 },
      ];
      const deviationRows: unknown[] = [];

      const pool = makePool([summaryRows, bucketRows, deviationRows]);
      const agent = new FeeEstimationAccuracyReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.accuracyBuckets).toHaveLength(4);
      expect(report.accuracyBuckets[0].bucket).toBe('excellent');
      expect(report.accuracyBuckets[0].count).toBe(FIXTURE_EXPECTED.excellentCount);
      expect(report.accuracyBuckets[0].description).toBe('±5 stroops or less');
    });

    it('includes significant deviations', async () => {
      const summaryRows = [{ total_estimations: 8, avg_error: 28.625, avg_error_percent: 15.5, overestimated: 2, underestimated: 5, accurate: 3 }];
      const bucketRows: unknown[] = [];
      const deviationRows = [
        { transaction_id: 'tx7', fee_estimated: 150, fee_charged: 250, deviation: 100, deviation_percent: 66.67, created_at: new Date(), contract_type: 'bulk' },
        { transaction_id: 'tx8', fee_estimated: 200, fee_charged: 130, deviation: 70, deviation_percent: 35, created_at: new Date(), contract_type: 'bulk' },
      ];

      const pool = makePool([summaryRows, bucketRows, deviationRows]);
      const agent = new FeeEstimationAccuracyReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.significantDeviations).toHaveLength(2);
      expect(report.significantDeviations[0].transactionId).toBe('tx7');
      expect(report.significantDeviations[0].deviation).toBe(100);
    });

    it('generates insights based on accuracy data', async () => {
      const summaryRows = [{ total_estimations: 100, avg_error: 10, avg_error_percent: 50, overestimated: 80, underestimated: 10, accurate: 85 }];
      const bucketRows: unknown[] = [];
      const deviationRows: unknown[] = [];

      const pool = makePool([summaryRows, bucketRows, deviationRows]);
      const agent = new FeeEstimationAccuracyReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.insights.length).toBeGreaterThan(0);
      // High accuracy rate should generate strength insight
      const strengthInsight = report.insights.find((i: any) => i.type === 'strength');
      expect(strengthInsight).toBeDefined();
      // High error percent should generate recommendation
      const recommendation = report.insights.find((i: any) => i.type === 'recommendation');
      expect(recommendation).toBeDefined();
    });

    it('detects overestimation bias', async () => {
      const summaryRows = [{ total_estimations: 100, avg_error: 10, avg_error_percent: 10, overestimated: 70, underestimated: 20, accurate: 10 }];
      const bucketRows: unknown[] = [];
      const deviationRows: unknown[] = [];

      const pool = makePool([summaryRows, bucketRows, deviationRows]);
      const agent = new FeeEstimationAccuracyReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      const overestimationWeakness = report.insights.find((i: any) => 
        i.type === 'weakness' && i.message.includes('overestimated')
      );
      expect(overestimationWeakness).toBeDefined();
    });

    it('detects underestimation bias', async () => {
      const summaryRows = [{ total_estimations: 100, avg_error: 10, avg_error_percent: 10, overestimated: 20, underestimated: 70, accurate: 10 }];
      const bucketRows: unknown[] = [];
      const deviationRows: unknown[] = [];

      const pool = makePool([summaryRows, bucketRows, deviationRows]);
      const agent = new FeeEstimationAccuracyReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      const underestimationWeakness = report.insights.find((i: any) => 
        i.type === 'weakness' && i.message.includes('underestimated')
      );
      expect(underestimationWeakness).toBeDefined();
    });

    it('applies date filters when provided', async () => {
      const pool = makePool([[], [], []]);
      const agent = new FeeEstimationAccuracyReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('created_at >= $2');
      expect(sql).toContain('created_at <= $3');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new FeeEstimationAccuracyReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
