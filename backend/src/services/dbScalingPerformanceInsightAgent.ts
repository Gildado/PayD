/**
 * DB Scaling & Performance Insight Agent (#1312)
 *
 * Produces a narrative insight report from raw DB scaling metrics.
 * Sources data from dbScalingService.ts (connection-pool, health,
 * database, slow-query, cache-hit, and index-usage metrics).
 *
 * Output schema:
 *   - summary: health, pool utilisation, cache hit ratio, deadlocks,
 *     slow query volume, DB throughput
 *   - metrics: raw snapshot of pool / database / slow queries / cache / indexes
 *   - insights: narrative entries ({ type, area, message, severity })
 *   - recommendations: prioritized actionable items
 *
 * The report is tested with an injected data source so no live DB is
 * required; it defaults to the real DbScalingService in production.
 */

import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';
import { DbScalingService } from './dbScalingService.js';

export interface DbScalingPerformanceFilters {
  thresholdMs?: number;
  limit?: number;
}

export interface DbScalingDataSource {
  getPoolStats(): Promise<{
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    maxConnections: number;
  }>;
  runHealthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
  getDatabaseStats(): Promise<{
    database: string;
    numBackends: number;
    xactCommit: number;
    xactRollback: number;
    blksRead: number;
    blksHit: number;
    cacheHitRatio: number;
    deadlocks: number;
    tempFiles: number;
    tempBytes: number;
  }>;
  getSlowQueries(thresholdMs: number, limit: number): Promise<
    Array<{ query: string; calls: number; avgMs: number; totalMs: number }>
  >;
  getCacheHitRate(): Promise<
    Array<{ table: string; heapHitRate: number; idxHitRate: number }>
  >;
  getUnusedIndexes(): Promise<
    Array<{ table: string; index: string; indexSizeBytes: number }>
  >;
}

export interface InsightEntry {
  type: 'info' | 'optimization' | 'warning' | 'critical';
  area: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface DbScalingPerformanceInsightReport {
  schemaVersion: string;
  summary: {
    healthy: boolean;
    latencyMs: number;
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    poolUtilisationPct: number;
    cacheHitRatio: number;
    deadlocks: number;
    transactions: number;
    slowQueryCount: number;
    unusedIndexCount: number;
    database: string;
  };
  metrics: {
    pool: Record<string, number>;
    database: Record<string, number>;
    slowQueries: Array<{ query: string; calls: number; avgMs: number; totalMs: number }>;
    cacheHitRates: Array<{ table: string; heapHitRate: number; idxHitRate: number }>;
    unusedIndexes: Array<{ table: string; index: string; indexSizeBytes: number }>;
  };
  insights: InsightEntry[];
  recommendations: string[];
}

export class DbScalingPerformanceInsightAgent implements IReportAgent {
  id = 'db-scaling-performance';
  name = 'DB Scaling & Performance Insight';
  description = 'Produces a narrative insight report from raw DB scaling metrics';

  private dataSource: DbScalingDataSource;

  constructor(dataSource?: Partial<DbScalingDataSource>) {
    // Default to the real service when no data source is injected.
    this.dataSource = (dataSource ?? new DbScalingService()) as DbScalingDataSource;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as DbScalingPerformanceFilters | undefined;
    const thresholdMs = f?.thresholdMs ?? 1000;
    const limit = Math.min(f?.limit ?? 20, 100);

    const [pool, health, dbStats, slowQueries, cacheHitRates, unusedIndexes] =
      await Promise.all([
        this.dataSource.getPoolStats(),
        this.dataSource.runHealthCheck(),
        this.dataSource.getDatabaseStats(),
        this.dataSource.getSlowQueries(thresholdMs, limit),
        this.dataSource.getCacheHitRate(),
        this.dataSource.getUnusedIndexes(),
      ]);

    const poolUtilisationPct =
      pool.maxConnections > 0
        ? Number(((pool.activeConnections / pool.maxConnections) * 100).toFixed(2))
        : 0;

    const avgCacheHitRatio =
      cacheHitRates.length > 0
        ? cacheHitRates.reduce((s, c) => s + c.heapHitRate, 0) / cacheHitRates.length
        : 1;

    const insights: InsightEntry[] = [];
    const recommendations: string[] = [];

    // Health
    if (!health.ok) {
      insights.push({
        type: 'critical',
        area: 'database-health',
        message: `Database health check failed after ${health.latencyMs}ms.`,
        severity: 'high',
      });
      recommendations.push('Restore database connectivity and re-run the health probe.');
    } else if (health.latencyMs > 2000) {
      insights.push({
        type: 'warning',
        area: 'database-health',
        message: `Database health probe latency is ${health.latencyMs}ms — above the 2000ms budget.`,
        severity: 'medium',
      });
      recommendations.push('Inspect db_io / storage latency and connection pool throttling.');
    } else {
      insights.push({
        type: 'info',
        area: 'database-health',
        message: `Database is healthy (probe ${health.latencyMs}ms).`,
        severity: 'low',
      });
    }

    // Connection pool
    if (poolUtilisationPct >= 80) {
      insights.push({
        type: 'warning',
        area: 'connection-pool',
        message: `Connection pool is ${poolUtilisationPct}% utilised (${pool.activeConnections}/${pool.maxConnections}).`,
        severity: 'high',
      });
      recommendations.push('Raise DB_POOL_MAX or add read replicas to reduce pool saturation.');
    }
    if (pool.waitingRequests > 0) {
      insights.push({
        type: 'warning',
        area: 'connection-pool',
        message: `${pool.waitingRequests} request(s) are waiting for a connection.`,
        severity: 'medium',
      });
      recommendations.push('Shorten long transactions and/or increase pool size.');
    }

    // Caching
    if (avgCacheHitRatio < 0.9) {
      insights.push({
        type: 'optimization',
        area: 'buffer-cache',
        message: `Average buffer-cache hit ratio is ${(avgCacheHitRatio * 100).toFixed(1)}% — below the 90% target.`,
        severity: 'medium',
      });
      recommendations.push('Increase effective_cache_size or warm frequently read tables.');
    } else {
      insights.push({
        type: 'info',
        area: 'buffer-cache',
        message: `Buffer-cache hit ratio is healthy (${(avgCacheHitRatio * 100).toFixed(1)}%).`,
        severity: 'low',
      });
    }

    // Deadlocks
    if (dbStats.deadlocks > 0) {
      insights.push({
        type: 'warning',
        area: 'transactions',
        message: `${dbStats.deadlocks} deadlock(s) detected — review lock ordering across writes.`,
        severity: 'high',
      });
      recommendations.push('Audit transactional lock ordering to eliminate deadlocks.');
    }

    // Slow queries
    if (slowQueries.length > 0) {
      const worst = slowQueries[0];
      insights.push({
        type: 'optimization',
        area: 'slow-queries',
        message: `${slowQueries.length} query(s) exceed ${thresholdMs}ms; worst averages ${worst.avgMs}ms over ${worst.calls} call(s).`,
        severity: 'medium',
      });
      recommendations.push('Add indexes or rewrite the offending queries identified by the slow-query report.');
    }

    // Unused indexes
    if (unusedIndexes.length > 0) {
      const wastedBytes = unusedIndexes.reduce((s, i) => s + i.indexSizeBytes, 0);
      insights.push({
        type: 'optimization',
        area: 'indexes',
        message: `${unusedIndexes.length} unused index(es) are consuming ${(wastedBytes / 1024 / 1024).toFixed(1)} MB of storage.`,
        severity: 'medium',
      });
      recommendations.push('Drop unused indexes to reclaim storage and speed up writes.');
    } else {
      insights.push({
        type: 'info',
        area: 'indexes',
        message: 'No unused index bloat detected.',
        severity: 'low',
      });
    }

    const report: DbScalingPerformanceInsightReport = {
      schemaVersion: '1.0',
      summary: {
        healthy: health.ok,
        latencyMs: health.latencyMs,
        totalConnections: pool.activeConnections + pool.idleConnections,
        activeConnections: pool.activeConnections,
        idleConnections: pool.idleConnections,
        waitingRequests: pool.waitingRequests,
        poolUtilisationPct,
        cacheHitRatio: Number(avgCacheHitRatio.toFixed(4)),
        deadlocks: dbStats.deadlocks,
        transactions: dbStats.xactCommit + dbStats.xactRollback,
        slowQueryCount: slowQueries.length,
        unusedIndexCount: unusedIndexes.length,
        database: dbStats.database,
      },
      metrics: {
        pool: {
          activeConnections: pool.activeConnections,
          idleConnections: pool.idleConnections,
          waitingRequests: pool.waitingRequests,
          maxConnections: pool.maxConnections,
        },
        database: {
          numBackends: dbStats.numBackends,
          xactCommit: dbStats.xactCommit,
          xactRollback: dbStats.xactRollback,
          blksRead: dbStats.blksRead,
          blksHit: dbStats.blksHit,
          cacheHitRatio: dbStats.cacheHitRatio,
          deadlocks: dbStats.deadlocks,
          tempFiles: dbStats.tempFiles,
          tempBytes: dbStats.tempBytes,
        },
        slowQueries,
        cacheHitRates,
        unusedIndexes,
      },
      insights,
      recommendations,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: slowQueries.length + unusedIndexes.length,
        processedRecords: slowQueries.length + unusedIndexes.length,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'db-scaling-performance',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
