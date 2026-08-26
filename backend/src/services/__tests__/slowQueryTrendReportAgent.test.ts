/**
 * Tests for SlowQueryTrendReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { SlowQueryTrendReportAgent } from '../slowQueryTrendReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_THRESHOLD_MS,
  FIXTURE_ROWS,
} from './fixtures/slowQueryTrendFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  // Queue one-time results in query order so multi-query agents stay deterministic.
  const query = jest.fn();
  resolvedRows.forEach((rows) => query.mockResolvedValueOnce({ rows }));
  query.mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool;
}

// Helper: derive the DB-shaped summary row from the fixture dataset.
function summaryRow() {
  const ms = FIXTURE_ROWS.map((r) => r.execution_ms).sort((a, b) => a - b);
  const slow = FIXTURE_ROWS.filter((r) => r.execution_ms >= FIXTURE_THRESHOLD_MS).length;
  const total = FIXTURE_ROWS.length;
  const p95Index = 0.95 * (total - 1);
  const lo = Math.floor(p95Index);
  const hi = Math.ceil(p95Index);
  const p95 = lo === hi ? ms[lo] : ms[lo] + (ms[hi] - ms[lo]) * (p95Index - lo);
  const avg = ms.reduce((s, v) => s + v, 0) / total;
  return [{
    total_queries: total,
    slow_queries: slow,
    avg_execution_ms: String(avg),
    p95_execution_ms: p95,
    max_execution_ms: Math.max(...ms),
    cache_hits: FIXTURE_ROWS.filter((r) => r.cache_hit).length,
    window_start: new Date('2024-03-13T00:00:00Z'),
    window_end: new Date('2024-03-15T00:00:00Z'),
  }];
}

// Helper: derive the daily-trend DB rows from the fixture dataset.
function trendRows() {
  const byDay = new Map<string, number[]>();
  for (const r of FIXTURE_ROWS) {
    const day = r.recorded_at.toISOString().split('T')[0];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(r.execution_ms);
  }
  return [...byDay.entries()].map(([_, mss]) => ({
    period: new Date(mss.length === 0 ? new Date() : FIXTURE_ROWS.find((r) => r.execution_ms === mss[0])!.recorded_at),
    total_queries: mss.length,
    slow_queries: mss.filter((v) => v >= FIXTURE_THRESHOLD_MS).length,
    avg_execution_ms: String(mss.reduce((s, v) => s + v, 0) / mss.length),
  }));
}

// Helper: derive the top-offending-query DB rows from the fixture dataset.
function offendingRows() {
  const groups = new Map<string, { call_count: number; slow: number; sum: number; max: number; cache: number }>();
  for (const r of FIXTURE_ROWS) {
    const key = `${r.endpoint}|${r.query_hash}`;
    const g = groups.get(key) ?? { call_count: 0, slow: 0, sum: 0, max: 0, cache: 0 };
    g.call_count += 1;
    if (r.execution_ms >= FIXTURE_THRESHOLD_MS) g.slow += 1;
    g.sum += r.execution_ms;
    g.max = Math.max(g.max, r.execution_ms);
    if (r.cache_hit) g.cache += 1;
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const [endpoint, query_hash] = key.split('|');
      return {
        endpoint,
        query_hash,
        call_count: g.call_count,
        slow_calls: g.slow,
        avg_execution_ms: String(g.sum / g.call_count),
        max_execution_ms: g.max,
        cache_hits: g.cache,
      };
    })
    .sort((a, b) => b.slow_calls - a.slow_calls || b.avg_execution_ms.localeCompare(a.avg_execution_ms));
}

describe('SlowQueryTrendReportAgent', () => {
  describe('execute()', () => {
    it('returns a JSON report and uses the default slow-query threshold', async () => {
      const pool = makePool([summaryRow(), trendRows(), offendingRows()]);
      const agent = new SlowQueryTrendReportAgent(pool);

      const result = await agent.execute({ windowDays: 7 });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.totalQueries).toBe(FIXTURE_EXPECTED.totalQueries);
      expect(report.summary.slowQueries).toBe(FIXTURE_EXPECTED.slowQueries);
      expect(report.summary.slowQueryRate).toBe(FIXTURE_EXPECTED.slowQueryRate);
      expect(report.summary.avgExecutionMs).toBeCloseTo(FIXTURE_EXPECTED.avgExecutionMs, 1);
      expect(report.summary.p95ExecutionMs).toBeCloseTo(FIXTURE_EXPECTED.p95ExecutionMs, 1);
      expect(report.summary.maxExecutionMs).toBe(FIXTURE_EXPECTED.maxExecutionMs);
      expect(report.summary.cacheHitRate).toBeCloseTo(FIXTURE_EXPECTED.cacheHitRate, 5);
      expect(report.summary.thresholdMs).toBe(FIXTURE_THRESHOLD_MS);
    });

    it('includes daily slow-query trends', async () => {
      const pool = makePool([summaryRow(), trendRows(), offendingRows()]);
      const agent = new SlowQueryTrendReportAgent(pool);

      const result = await agent.execute({ windowDays: 7 });
      const report = result.data![0] as any;

      expect(report.trends).toHaveLength(FIXTURE_EXPECTED.trendsLength);
      expect(report.trends[0].period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(report.trends[0].totalQueries).toBeGreaterThan(0);
    });

    it('identifies the top offending queries', async () => {
      const pool = makePool([summaryRow(), trendRows(), offendingRows()]);
      const agent = new SlowQueryTrendReportAgent(pool);

      const result = await agent.execute({ windowDays: 7 });
      const report = result.data![0] as any;

      expect(report.topOffendingQueries).toHaveLength(3);
      expect(report.topOffendingQueries[0].endpoint).toBe(FIXTURE_EXPECTED.topOffender0.endpoint);
      expect(report.topOffendingQueries[0].slowCalls).toBe(FIXTURE_EXPECTED.topOffender0.slowCalls);
      expect(report.topOffendingQueries[0].avgExecutionMs).toBeCloseTo(FIXTURE_EXPECTED.topOffender0.avgExecutionMs, 2);
    });

    it('generates insights when the slow-query rate exceeds the threshold', async () => {
      const pool = makePool([summaryRow(), trendRows(), offendingRows()]);
      const agent = new SlowQueryTrendReportAgent(pool);

      const result = await agent.execute({ windowDays: 7 });
      const report = result.data![0] as any;

      expect(report.recommendations.length).toBeGreaterThan(0);
      const rateWarning = report.recommendations.find((r: any) => r.type === 'warning');
      expect(rateWarning).toBeDefined();
    });

    it('supports a custom threshold and limit', async () => {
      const pool = makePool([summaryRow(), [], offendingRows()]);
      const agent = new SlowQueryTrendReportAgent(pool);

      await agent.execute({ thresholdMs: 200, limit: 10 });

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('recorded_at >= $1');
      expect(sql).toContain('recorded_at <= $2');
      // threshold is applied as an inline $3 filter for slow detection
      expect(params[2]).toBe(200);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new SlowQueryTrendReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
