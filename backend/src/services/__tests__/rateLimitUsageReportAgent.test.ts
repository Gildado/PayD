import { jest, describe, it, expect } from '@jest/globals';
import { RateLimitUsageReportAgent } from '../rateLimitUsageReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_USAGE_ROWS,
  FIXTURE_EXPECTED,
} from './fixtures/rateLimitUsageFixture.js';

function makePool(rows: unknown[]): Pool {
  return { query: jest.fn().mockResolvedValue({ rows }) } as unknown as Pool;
}

describe('RateLimitUsageReportAgent', () => {
  describe('execute()', () => {
    it('returns correct summary counts', async () => {
      const pool = makePool(FIXTURE_USAGE_ROWS);
      const agent = new RateLimitUsageReportAgent(pool);

      const result = await agent.execute({});
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.totalIdentifiers).toBe(FIXTURE_EXPECTED.totalIdentifiers);
      expect(report.summary.totalTiers).toBe(FIXTURE_EXPECTED.totalTiers);
    });

    it('identifies near-threshold clients at 80%', async () => {
      const pool = makePool(FIXTURE_USAGE_ROWS);
      const agent = new RateLimitUsageReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.summary.nearThresholdCount).toBe(FIXTURE_EXPECTED.nearThresholdCountDefault);
    });

    it('respects custom threshold percent', async () => {
      const pool = makePool(FIXTURE_USAGE_ROWS);
      const agent = new RateLimitUsageReportAgent(pool);

      const result = await agent.execute({ thresholdPercent: 50 });
      const report = result.data![0] as any;

      expect(report.summary.nearThresholdCount).toBe(FIXTURE_EXPECTED.nearThresholdCount50);
    });

    it('returns tier breakdown with correct totals', async () => {
      const pool = makePool(FIXTURE_USAGE_ROWS);
      const agent = new RateLimitUsageReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      const apiTier = report.summary.tierBreakdown.find((t: any) => t.tier === 'api');
      expect(apiTier).toBeDefined();
      expect(apiTier.used).toBe(FIXTURE_EXPECTED.apiUsedTotal);

      const authTier = report.summary.tierBreakdown.find((t: any) => t.tier === 'auth');
      expect(authTier.used).toBe(FIXTURE_EXPECTED.authUsedTotal);
    });

    it('returns top consumers sorted by usage', async () => {
      const pool = makePool(FIXTURE_USAGE_ROWS);
      const agent = new RateLimitUsageReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.topConsumers.length).toBeGreaterThan(0);
      expect(report.topConsumers[0].identifier).toBe(FIXTURE_EXPECTED.topConsumerId);
    });

    it('returns near-threshold clients with percentUsed', async () => {
      const pool = makePool(FIXTURE_USAGE_ROWS);
      const agent = new RateLimitUsageReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      for (const client of report.nearThresholdClients) {
        expect(client.percentUsed).toBeGreaterThanOrEqual(80);
      }
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new RateLimitUsageReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
