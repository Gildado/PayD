/**
 * Slow Query Trend Report Agent (#1310)
 *
 * Analyzes slow-query trends and top offending queries over time.
 * Sources data from the `db_query_stats` table that slowQueryMonitorService.ts
 * populates on each tracked database query, plus the monitor's slow-query
 * threshold semantics.
 *
 * Output schema:
 *   - summary: totalQueries, slowQueries, slowQueryRate, avgExecutionMs,
 *     p95ExecutionMs, maxExecutionMs, cacheHitRate, thresholdMs, window
 *   - trends: daily slow-query time-series
 *   - topOffendingQueries: grouped by endpoint + query_hash, ordered by
 *     slow-call count
 *   - recommendations: actionable optimization suggestions
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface SlowQueryTrendFilters {
  thresholdMs?: number;
  windowDays?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface SlowQueryTrendDatum {
  period: string;
  totalQueries: number;
  slowQueries: number;
  avgExecutionMs: number;
}

export interface TopOffendingQuery {
  endpoint: string | null;
  queryHash: string | null;
  callCount: number;
  slowCalls: number;
  avgExecutionMs: number;
  maxExecutionMs: number | null;
  cacheHitRate: number;
}

export interface InsightRecommendation {
  type: 'optimization' | 'warning' | 'info';
  target?: string;
  message: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface SlowQueryTrendReport {
  schemaVersion: string;
  summary: {
    totalQueries: number;
    slowQueries: number;
    slowQueryRate: number;
    avgExecutionMs: number;
    p95ExecutionMs: number;
    maxExecutionMs: number | null;
    cacheHitRate: number;
    thresholdMs: number;
    windowStart: string | null;
    windowEnd: string | null;
  };
  trends: SlowQueryTrendDatum[];
  topOffendingQueries: TopOffendingQuery[];
  recommendations: InsightRecommendation[];
}

export class SlowQueryTrendReportAgent implements IReportAgent {
  id = 'slow-query-trend';
  name = 'Slow Query Trend Report';
  description = 'Analyzes slow-query trends and top offending queries over time';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as SlowQueryTrendFilters | undefined;
    const thresholdMs = f?.thresholdMs ?? 500;
    const windowDays = f?.windowDays ?? 7;
    const limit = Math.min(f?.limit ?? 20, 100);

    const endDate = f?.endDate ? new Date(f.endDate) : new Date();
    const startDate = f?.startDate
      ? new Date(f.startDate)
      : new Date(endDate.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const params: any[] = [startDate, endDate, thresholdMs, limit];

    // 1) Overall summary stats across the window
    const summaryResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_queries,
        COUNT(*) FILTER (WHERE execution_ms >= $3)::int AS slow_queries,
        COALESCE(AVG(execution_ms), 0)::numeric(14,2) AS avg_execution_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms) AS p95_execution_ms,
        MAX(execution_ms) AS max_execution_ms,
        COUNT(*) FILTER (WHERE cache_hit = TRUE)::int AS cache_hits,
        MIN(recorded_at) AS window_start,
        MAX(recorded_at) AS window_end
      FROM db_query_stats
      WHERE recorded_at >= $1 AND recorded_at <= $2`,
      [params[0], params[1], params[2]]
    );

    const summaryRow = summaryResult.rows[0];
    const totalQueries = summaryRow?.total_queries ?? 0;
    const slowQueries = summaryRow?.slow_queries ?? 0;
    const cacheHits = summaryRow?.cache_hits ?? 0;

    // 2) Daily slow-query trends
    const trendResult = await this.pool.query(
      `SELECT
        DATE_TRUNC('day', recorded_at) AS period,
        COUNT(*)::int AS total_queries,
        COUNT(*) FILTER (WHERE execution_ms >= $3)::int AS slow_queries,
        COALESCE(AVG(execution_ms), 0)::numeric(14,2) AS avg_execution_ms
      FROM db_query_stats
      WHERE recorded_at >= $1 AND recorded_at <= $2
      GROUP BY DATE_TRUNC('day', recorded_at)
      ORDER BY period DESC
      LIMIT $4`,
      params
    );

    const trends: SlowQueryTrendDatum[] = trendResult.rows.map((row) => ({
      period: new Date(row.period).toISOString().split('T')[0],
      totalQueries: row.total_queries,
      slowQueries: row.slow_queries,
      avgExecutionMs: parseFloat(row.avg_execution_ms),
    }));

    // 3) Top offending queries (grouped by endpoint + query_hash)
    const offendingResult = await this.pool.query(
      `SELECT
        endpoint,
        query_hash,
        COUNT(*)::int AS call_count,
        COUNT(*) FILTER (WHERE execution_ms >= $3)::int AS slow_calls,
        COALESCE(AVG(execution_ms), 0)::numeric(14,2) AS avg_execution_ms,
        MAX(execution_ms) AS max_execution_ms,
        COUNT(*) FILTER (WHERE cache_hit = TRUE)::int AS cache_hits
      FROM db_query_stats
      WHERE recorded_at >= $1 AND recorded_at <= $2
      GROUP BY endpoint, query_hash
      ORDER BY slow_calls DESC, avg_execution_ms DESC
      LIMIT $4`,
      params
    );

    const topOffendingQueries: TopOffendingQuery[] = offendingResult.rows.map((row) => ({
      endpoint: row.endpoint,
      queryHash: row.query_hash,
      callCount: row.call_count,
      slowCalls: row.slow_calls,
      avgExecutionMs: parseFloat(row.avg_execution_ms),
      maxExecutionMs: row.max_execution_ms,
      cacheHitRate: row.call_count > 0 ? row.cache_hits / row.call_count : 0,
    }));

    const summary = summaryRow ?? {};
    const avgExecutionMs = parseFloat(summary.avg_execution_ms ?? '0');
    const p95ExecutionMs = summary.p95_execution_ms ?? 0;
    const maxExecutionMs = summary.max_execution_ms ?? null;
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 1;
    const slowQueryRate =
      totalQueries > 0 ? Number(((slowQueries / totalQueries) * 100).toFixed(2)) : 0;

    const recommendations = this.buildRecommendations({
      totalQueries,
      slowQueries,
      slowQueryRate,
      avgExecutionMs,
      p95ExecutionMs,
      cacheHitRate,
      thresholdMs,
      topOffendingQueries,
    });

    const report: SlowQueryTrendReport = {
      schemaVersion: '1.0',
      summary: {
        totalQueries,
        slowQueries,
        slowQueryRate,
        avgExecutionMs,
        p95ExecutionMs,
        maxExecutionMs,
        cacheHitRate,
        thresholdMs,
        windowStart: summary.window_start ? new Date(summary.window_start).toISOString() : null,
        windowEnd: summary.window_end ? new Date(summary.window_end).toISOString() : null,
      },
      trends,
      topOffendingQueries,
      recommendations,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalQueries,
        processedRecords: totalQueries,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'slow-query-trend',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }

  private buildRecommendations(input: {
    totalQueries: number;
    slowQueries: number;
    slowQueryRate: number;
    avgExecutionMs: number;
    p95ExecutionMs: number;
    cacheHitRate: number;
    thresholdMs: number;
    topOffendingQueries: TopOffendingQuery[];
  }): InsightRecommendation[] {
    const recommendations: InsightRecommendation[] = [];

    if (input.totalQueries === 0) {
      recommendations.push({
        type: 'info',
        message: 'No query data observed in the selected window. Nothing to optimize.',
      });
      return recommendations;
    }

    if (input.slowQueryRate > 5) {
      recommendations.push({
        type: 'warning',
        message: `Slow query rate is ${input.slowQueryRate}% — above the 5% threshold. Review the hottest endpoints.`,
        target: 'database',
        severity: 'medium',
      });
    }

    if (input.p95ExecutionMs > 0 && input.p95ExecutionMs > input.thresholdMs * 3) {
      recommendations.push({
        type: 'warning',
        message: `p95 execution is ${Math.round(input.p95ExecutionMs)}ms — ${Math.round(
          input.p95ExecutionMs / input.thresholdMs
        )}x the ${input.thresholdMs}ms slow-query threshold.`,
        target: 'database',
        severity: 'high',
      });
    }

    if (input.cacheHitRate < 0.5) {
      recommendations.push({
        type: 'optimization',
        message: `Buffer-cache hit rate is low (${(input.cacheHitRate * 100).toFixed(0)}%). Consider increasing effective_cache_size or warming caches.`,
        target: 'caching',
        severity: 'medium',
      });
    }

    for (const q of input.topOffendingQueries) {
      if (q.avgExecutionMs > input.thresholdMs * 2 && q.slowCalls >= 3) {
        recommendations.push({
          type: 'optimization',
          target: q.endpoint ?? q.queryHash ?? 'unknown',
          message: `Endpoint "${q.endpoint ?? 'unknown'}" averages ${Math.round(q.avgExecutionMs)}ms over ${q.slowCalls} slow call(s). Add an index or narrow the result set.`,
          severity: 'high',
        });
      }
    }

    recommendations.push({
      type: 'info',
      message: `Monitored ${input.totalQueries} queries with ${input.slowQueries} slow query(s) in the window.`,
    });

    return recommendations;
  }
}
