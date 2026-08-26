/**
 * Tests for DbScalingPerformanceInsightAgent
 *
 * Uses an injected mock data source — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { DbScalingPerformanceInsightAgent } from '../dbScalingPerformanceInsightAgent.js';
import type { DbScalingDataSource } from '../dbScalingPerformanceInsightAgent.js';
import {
  FIXTURE_EXPECTED,
  FIXTURE_POOL,
  FIXTURE_HEALTH,
  FIXTURE_DB_STATS,
  FIXTURE_SLOW_QUERIES,
  FIXTURE_CACHE_HIT_RATES,
  FIXTURE_UNUSED_INDEXES,
} from './fixtures/dbScalingPerformanceFixture.js';

function makeDataSource(overrides: Partial<DbScalingDataSource> = {}): DbScalingDataSource {
  return {
    getPoolStats: jest.fn().mockResolvedValue(FIXTURE_POOL),
    runHealthCheck: jest.fn().mockResolvedValue(FIXTURE_HEALTH),
    getDatabaseStats: jest.fn().mockResolvedValue(FIXTURE_DB_STATS),
    getSlowQueries: jest.fn().mockResolvedValue(FIXTURE_SLOW_QUERIES),
    getCacheHitRate: jest.fn().mockResolvedValue(FIXTURE_CACHE_HIT_RATES),
    getUnusedIndexes: jest.fn().mockResolvedValue(FIXTURE_UNUSED_INDEXES),
    ...overrides,
  };
}

describe('DbScalingPerformanceInsightAgent', () => {
  describe('execute()', () => {
    it('summarises the raw scaling metrics correctly', async () => {
      const agent = new DbScalingPerformanceInsightAgent(makeDataSource());
      const result = await agent.execute({});

      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.healthy).toBe(FIXTURE_EXPECTED.healthy);
      expect(report.summary.latencyMs).toBe(FIXTURE_EXPECTED.latencyMs);
      expect(report.summary.totalConnections).toBe(FIXTURE_EXPECTED.totalConnections);
      expect(report.summary.activeConnections).toBe(FIXTURE_EXPECTED.activeConnections);
      expect(report.summary.waitingRequests).toBe(FIXTURE_EXPECTED.waitingRequests);
      expect(report.summary.poolUtilisationPct).toBe(FIXTURE_EXPECTED.poolUtilisationPct);
      expect(report.summary.cacheHitRatio).toBeCloseTo(FIXTURE_EXPECTED.cacheHitRatio, 3);
      expect(report.summary.deadlocks).toBe(FIXTURE_EXPECTED.deadlocks);
      expect(report.summary.transactions).toBe(FIXTURE_EXPECTED.transactions);
      expect(report.summary.slowQueryCount).toBe(FIXTURE_EXPECTED.slowQueryCount);
      expect(report.summary.unusedIndexCount).toBe(FIXTURE_EXPECTED.unusedIndexCount);
    });

    it('surfaces the raw metrics snapshot', async () => {
      const agent = new DbScalingPerformanceInsightAgent(makeDataSource());
      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.metrics.pool.maxConnections).toBe(FIXTURE_POOL.maxConnections);
      expect(report.metrics.database.cacheHitRatio).toBe(FIXTURE_DB_STATS.cacheHitRatio);
      expect(report.metrics.slowQueries).toHaveLength(1);
      expect(report.metrics.slowQueries[0].avgMs).toBe(2500);
      expect(report.metrics.cacheHitRates).toHaveLength(2);
      expect(report.metrics.unusedIndexes[0].index).toBe('idx_unused_payroll');
    });

    it('generates narrative insights from the metrics', async () => {
      const agent = new DbScalingPerformanceInsightAgent(makeDataSource());
      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.insights.length).toBeGreaterThan(0);
      // Pool saturation (90%) should be flagged
      const poolInsight = report.insights.find((i: any) => i.area === 'connection-pool');
      expect(poolInsight).toBeDefined();
      // Deadlocks should be flagged
      const txInsight = report.insights.find((i: any) => i.area === 'transactions');
      expect(txInsight).toBeDefined();
      // Slow queries should produce an optimization insight
      const slowInsight = report.insights.find((i: any) => i.area === 'slow-queries');
      expect(slowInsight).toBeDefined();
      // Unused indexes should produce an optimization insight
      const idxInsight = report.insights.find((i: any) => i.area === 'indexes');
      expect(idxInsight).toBeDefined();
      // Cache hit ratio below 0.9 should be flagged
      const cacheInsight = report.insights.find((i: any) => i.area === 'buffer-cache');
      expect(cacheInsight).toBeDefined();
    });

    it('produces prioritized recommendations', async () => {
      const agent = new DbScalingPerformanceInsightAgent(makeDataSource());
      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.recommendations.length).toBeGreaterThan(2);
      expect(report.recommendations.join(' ')).toMatch(/pool/i);
      expect(report.recommendations.join(' ')).toMatch(/deadlock/i);
    });

    it('flags a failing health check as critical', async () => {
      const agent = new DbScalingPerformanceInsightAgent(
        makeDataSource({
          runHealthCheck: jest.fn().mockResolvedValue({ ok: false, latencyMs: 10 }),
        })
      );
      const result = await agent.execute({});
      const report = result.data![0] as any;

      const healthInsight = report.insights.find((i: any) => i.area === 'database-health');
      expect(healthInsight.type).toBe('critical');
      expect(report.summary.healthy).toBe(false);
    });

    it('passes threshold and limit filters to the data source', async () => {
      const getSlowQueries = jest.fn().mockResolvedValue(FIXTURE_SLOW_QUERIES);
      const agent = new DbScalingPerformanceInsightAgent(makeDataSource({ getSlowQueries }));
      await agent.execute({ thresholdMs: 200, limit: 5 });

      expect(getSlowQueries).toHaveBeenCalledWith(200, 5);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const agent = new DbScalingPerformanceInsightAgent(makeDataSource());
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
