import { jest, describe, it, expect } from '@jest/globals';
import { AnomalySummaryDigestAgent } from '../anomalySummaryDigestAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_ANOMALY_ROWS,
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/anomalySummaryDigestFixture.js';

function makePool(rows: unknown[]): Pool {
  const fn = jest.fn().mockResolvedValue({ rows });
  return { query: fn } as unknown as Pool;
}

describe('AnomalySummaryDigestAgent', () => {
  describe('execute()', () => {
    it('returns correct anomaly summary and breakdown', async () => {
      const pool = makePool(FIXTURE_ANOMALY_ROWS);
      const agent = new AnomalySummaryDigestAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0];
      expect(report.summary.totalAnomalies).toBe(FIXTURE_EXPECTED.totalAnomalies);
      expect(report.summary.criticalCount).toBe(FIXTURE_EXPECTED.criticalCount);
      expect(report.summary.warningCount).toBe(FIXTURE_EXPECTED.warningCount);
      expect(report.summary.infoCount).toBe(FIXTURE_EXPECTED.infoCount);
      expect(report.summary.topAgent).toBe(FIXTURE_EXPECTED.topAgent);
      expect(report.anomaliesBySeverity.critical).toHaveLength(1);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('filters by organizationId and dates', async () => {
      const pool = makePool([]);
      const agent = new AnomalySummaryDigestAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      });

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, any[]];
      expect(sql).toContain('organization_id = $1');
      expect(sql).toContain('detected_at >= $2');
      expect(sql).toContain('detected_at <= $3');
      expect(params[0]).toBe(FIXTURE_ORG_ID);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new AnomalySummaryDigestAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
