import { jest, describe, it, expect } from '@jest/globals';
import { ContributorRewardsReportAgent } from '../contributorRewardsReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_REWARD_ROWS,
  FIXTURE_EXPECTED,
} from './fixtures/contributorRewardsFixture.js';

function makePool(overrides: { tier?: unknown[]; unique?: unknown[]; recent?: unknown[]; top?: unknown[] } = {}): Pool {
  const fn = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('GROUP BY tier')) return Promise.resolve({ rows: overrides.tier ?? [] });
    if (sql.includes('COUNT(DISTINCT')) return Promise.resolve({ rows: overrides.unique ?? [] });
    if (sql.includes('ARRAY_AGG')) return Promise.resolve({ rows: overrides.top ?? [] });
    return Promise.resolve({ rows: overrides.recent ?? [] });
  });
  return { query: fn } as unknown as Pool;
}

describe('ContributorRewardsReportAgent', () => {
  describe('execute()', () => {
    it('returns correct summary totals', async () => {
      const tierRows = [
        { tier: 'minor', count: 3, total_amount: 300 },
        { tier: 'major', count: 1, total_amount: 500 },
        { tier: 'critical', count: 1, total_amount: 2000 },
      ];
      const uniqueRow = [{ unique_count: FIXTURE_EXPECTED.uniqueContributors }];

      const pool = makePool({ tier: tierRows, unique: uniqueRow, recent: FIXTURE_REWARD_ROWS });
      const agent = new ContributorRewardsReportAgent(pool);

      const result = await agent.execute({});
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.totalRewards).toBe(FIXTURE_EXPECTED.totalRewards);
      expect(report.summary.totalXlmDistributed).toBe(FIXTURE_EXPECTED.totalXlm);
      expect(report.summary.uniqueContributors).toBe(FIXTURE_EXPECTED.uniqueContributors);
    });

    it('returns tier breakdown with correct counts', async () => {
      const tierRows = [
        { tier: 'minor', count: 3, total_amount: 300 },
        { tier: 'major', count: 1, total_amount: 500 },
        { tier: 'critical', count: 1, total_amount: 2000 },
      ];

      const pool = makePool({ tier: tierRows, unique: [{ unique_count: 3 }] });
      const agent = new ContributorRewardsReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      const minor = report.summary.tierBreakdown.find((t: any) => t.tier === 'minor');
      expect(minor.count).toBe(FIXTURE_EXPECTED.minorCount);
      expect(minor.xlmAmount).toBe(FIXTURE_EXPECTED.minorXlm);

      const critical = report.summary.tierBreakdown.find((t: any) => t.tier === 'critical');
      expect(critical.count).toBe(FIXTURE_EXPECTED.criticalCount);
      expect(critical.xlmAmount).toBe(FIXTURE_EXPECTED.criticalXlm);
    });

    it('returns recent rewards', async () => {
      const pool = makePool({ tier: [{ tier: 'minor', count: 1, total_amount: 100 }], unique: [{ unique_count: 1 }], recent: FIXTURE_REWARD_ROWS });
      const agent = new ContributorRewardsReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.recentRewards).toHaveLength(FIXTURE_REWARD_ROWS.length);
    });

    it('returns top contributors', async () => {
      const topRows = [
        { contributor_address: 'GABC3', total_rewards: 1, total_xlm: 2000, tiers: ['critical'] },
      ];
      const pool = makePool({ tier: [{ tier: 'critical', count: 1, total_amount: 2000 }], unique: [{ unique_count: 1 }], top: topRows });
      const agent = new ContributorRewardsReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.topContributors).toHaveLength(1);
      expect(report.topContributors[0].contributorAddress).toBe(FIXTURE_EXPECTED.topContributorAddress);
    });

    it('applies date filters', async () => {
      const pool = makePool({ tier: [], unique: [{ unique_count: 0 }] });
      const agent = new ContributorRewardsReportAgent(pool);

      await agent.execute({
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      });

      const calls = (pool.query as jest.Mock).mock.calls.map(([sql]: [string]) => sql);
      const tierSql = calls.find((s: string) => s.includes('GROUP BY tier'));
      expect(tierSql).toContain('distributed_at >= $1');
      expect(tierSql).toContain('distributed_at <= $2');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new ContributorRewardsReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
