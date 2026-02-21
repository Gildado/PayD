import logger from '../logging/logger';

/**
 * Performance Metrics Collector
 *
 * Tracks and aggregates:
 * - HTTP request metrics (count, duration, status codes)
 * - Error rates across configurable time windows
 * - Database query performance
 * - Custom business metrics (transactions, payroll operations)
 *
 * Metrics are stored in-memory and exposed via the /api/monitoring/metrics endpoint.
 * When Elasticsearch is enabled, metrics are also shipped to the ELK stack.
 */

export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: Date;
}

export interface MetricsSummary {
  uptime: number;
  requests: {
    total: number;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
    averageDurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
  };
  errors: {
    total: number;
    rate: number; // errors per minute in the last window
    recent: Array<{
      message: string;
      path: string;
      timestamp: string;
      count: number;
    }>;
  };
  database: {
    queryCount: number;
    averageDurationMs: number;
    slowQueries: number;
  };
  system: {
    memoryUsageMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    cpuUser: number;
    cpuSystem: number;
  };
}

class MetricsCollector {
  private requestMetrics: RequestMetric[] = [];
  private errorLog: Array<{ message: string; path: string; timestamp: Date }> = [];
  private dbMetrics: { count: number; totalDurationMs: number; slowCount: number } = {
    count: 0,
    totalDurationMs: 0,
    slowCount: 0,
  };
  private readonly startTime: Date;
  private readonly maxMetricsRetained = 10000;
  private readonly errorWindowMs = 60_000; // 1 minute window for error rate
  private readonly slowQueryThresholdMs = 1000;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Record an HTTP request metric.
   */
  recordRequest(metric: RequestMetric): void {
    this.requestMetrics.push(metric);

    // Evict old metrics to prevent unbounded memory growth
    if (this.requestMetrics.length > this.maxMetricsRetained) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetricsRetained / 2);
    }

    // Log if status indicates error
    if (metric.statusCode >= 500) {
      logger.warn('Server error recorded', {
        type: 'metric',
        method: metric.method,
        path: metric.path,
        statusCode: metric.statusCode,
        durationMs: metric.durationMs,
      });
    }
  }

  /**
   * Record an error event.
   */
  recordError(message: string, path: string): void {
    this.errorLog.push({ message, path, timestamp: new Date() });

    // Keep only recent errors
    const cutoff = new Date(Date.now() - 5 * 60_000);
    this.errorLog = this.errorLog.filter((e) => e.timestamp > cutoff);
  }

  /**
   * Record a database query metric.
   */
  recordDatabaseQuery(durationMs: number): void {
    this.dbMetrics.count++;
    this.dbMetrics.totalDurationMs += durationMs;
    if (durationMs > this.slowQueryThresholdMs) {
      this.dbMetrics.slowCount++;
    }
  }

  /**
   * Calculate a percentile from a sorted array of numbers.
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Get the current error rate (errors per minute in the last 1-minute window).
   */
  getErrorRate(): number {
    const windowStart = new Date(Date.now() - this.errorWindowMs);
    const recentErrors = this.errorLog.filter((e) => e.timestamp > windowStart);
    return recentErrors.length;
  }

  /**
   * Aggregate and return all metrics as a summary.
   */
  getSummary(): MetricsSummary {
    const now = Date.now();
    const uptimeMs = now - this.startTime.getTime();

    // Request metrics
    const durations = this.requestMetrics.map((m) => m.durationMs).sort((a, b) => a - b);
    const byStatus: Record<string, number> = {};
    const byMethod: Record<string, number> = {};

    for (const m of this.requestMetrics) {
      const statusGroup = `${Math.floor(m.statusCode / 100)}xx`;
      byStatus[statusGroup] = (byStatus[statusGroup] || 0) + 1;
      byMethod[m.method] = (byMethod[m.method] || 0) + 1;
    }

    const totalDuration = durations.reduce((a, b) => a + b, 0);

    // Recent errors aggregated by message
    const errorWindowStart = new Date(now - 5 * 60_000);
    const recentErrors = this.errorLog.filter((e) => e.timestamp > errorWindowStart);
    const errorAgg = new Map<string, { path: string; timestamp: Date; count: number }>();
    for (const err of recentErrors) {
      const key = err.message;
      const existing = errorAgg.get(key);
      if (existing) {
        existing.count++;
        if (err.timestamp > existing.timestamp) existing.timestamp = err.timestamp;
      } else {
        errorAgg.set(key, { path: err.path, timestamp: err.timestamp, count: 1 });
      }
    }

    // System metrics
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    return {
      uptime: Math.floor(uptimeMs / 1000),
      requests: {
        total: this.requestMetrics.length,
        byStatus,
        byMethod,
        averageDurationMs: durations.length > 0 ? Math.round(totalDuration / durations.length) : 0,
        p95DurationMs: this.percentile(durations, 95),
        p99DurationMs: this.percentile(durations, 99),
      },
      errors: {
        total: (byStatus['5xx'] || 0),
        rate: this.getErrorRate(),
        recent: Array.from(errorAgg.entries())
          .map(([message, data]) => ({
            message,
            path: data.path,
            timestamp: data.timestamp.toISOString(),
            count: data.count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
      },
      database: {
        queryCount: this.dbMetrics.count,
        averageDurationMs:
          this.dbMetrics.count > 0
            ? Math.round(this.dbMetrics.totalDurationMs / this.dbMetrics.count)
            : 0,
        slowQueries: this.dbMetrics.slowCount,
      },
      system: {
        memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        cpuUser: cpu.user,
        cpuSystem: cpu.system,
      },
    };
  }

  /**
   * Reset all collected metrics.
   */
  reset(): void {
    this.requestMetrics = [];
    this.errorLog = [];
    this.dbMetrics = { count: 0, totalDurationMs: 0, slowCount: 0 };
  }
}

export const metricsCollector = new MetricsCollector();
export default metricsCollector;
