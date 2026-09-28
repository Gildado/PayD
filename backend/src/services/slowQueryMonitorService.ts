/**
 * Slow Query Monitoring Service (#1051)
 * 
 * Provides database query performance monitoring with:
 * - Query duration tracking
 * - Slow query logging with configurable threshold
 * - Query plan analysis for slow queries
 * - Missing index detection
 * - Prometheus metrics for slow query count
 * - Alerting when slow query rate exceeds threshold
 */

import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import { Counter, Histogram } from 'prom-client';
import { config } from '../config/env.js';

// Configuration
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '500', 10);
const SLOW_QUERY_RATE_ALERT_THRESHOLD = parseFloat(process.env.SLOW_QUERY_RATE_ALERT_THRESHOLD || '0.05'); // 5%

// Prometheus Metrics
export const queryDurationHistogram = new Histogram({
  name: 'payd_database_query_duration_seconds',
  help: 'Database query execution duration in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

export const slowQueryCounter = new Counter({
  name: 'payd_database_slow_queries_total',
  help: 'Total number of slow database queries',
  labelNames: ['query_type', 'table'],
});

export const totalQueryCounter = new Counter({
  name: 'payd_database_queries_total',
  help: 'Total number of database queries executed',
  labelNames: ['query_type'],
});

interface QueryLog {
  query: string;
  params?: any[];
  duration: number;
  timestamp: Date;
}

interface QueryPlan {
  plan: any;
  executionTime: number;
  planningTime: number;
}

interface SlowQueryAnalysis {
  query: string;
  sanitizedParams: string;
  duration: number;
  queryPlan?: QueryPlan;
  recommendations: string[];
  timestamp: Date;
}

export class SlowQueryMonitorService {
  private static instance: SlowQueryMonitorService;
  private queryLogs: QueryLog[] = [];
  private slowQueryCount = 0;
  private totalQueryCount = 0;
  private lastAlertTime = 0;
  private readonly ALERT_COOLDOWN_MS = 60000; // 1 minute between alerts

  private constructor() {
    // Start periodic slow query rate check
    setInterval(() => this.checkSlowQueryRate(), 30000); // Every 30 seconds
  }

  static getInstance(): SlowQueryMonitorService {
    if (!SlowQueryMonitorService.instance) {
      SlowQueryMonitorService.instance = new SlowQueryMonitorService();
    }
    return SlowQueryMonitorService.instance;
  }

  /**
   * Track a database query execution
   */
  async trackQuery(query: string, params: any[] | undefined, duration: number): Promise<void> {
    this.totalQueryCount++;
    const queryType = this.extractQueryType(query);
    const tableName = this.extractTableName(query);

    // Record metrics
    totalQueryCounter.labels(queryType).inc();
    queryDurationHistogram.labels(queryType, tableName || 'unknown').observe(duration / 1000);

    // Log and analyze if slow
    if (duration >= SLOW_QUERY_THRESHOLD_MS) {
      this.slowQueryCount++;
      slowQueryCounter.labels(queryType, tableName || 'unknown').inc();

      await this.handleSlowQuery(query, params, duration);
    }
  }

  /**
   * Handle slow query detection
   */
  private async handleSlowQuery(query: string, params: any[] | undefined, duration: number): Promise<void> {
    const analysis: SlowQueryAnalysis = {
      query,
      sanitizedParams: this.sanitizeParams(params),
      duration,
      recommendations: [],
      timestamp: new Date(),
    };

    try {
      // Get query execution plan
      analysis.queryPlan = await this.getQueryPlan(query, params);

      // Analyze for missing indexes
      analysis.recommendations = this.analyzeQueryPlan(analysis.queryPlan);
    } catch (error) {
      logger.warn('Failed to analyze slow query', { error, query: query.substring(0, 100) });
    }

    // Log slow query with full context
    logger.warn('Slow query detected', {
      duration_ms: duration,
      threshold_ms: SLOW_QUERY_THRESHOLD_MS,
      query: query.substring(0, 200), // Truncate for log size
      sanitized_params: analysis.sanitizedParams,
      query_plan: analysis.queryPlan,
      recommendations: analysis.recommendations,
      timestamp: analysis.timestamp.toISOString(),
    });
  }

  /**
   * Get PostgreSQL EXPLAIN plan for a query
   */
  private async getQueryPlan(query: string, params: any[] | undefined): Promise<QueryPlan | undefined> {
    try {
      // Use EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) for detailed plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await pool.query(explainQuery, params);

      if (result.rows && result.rows.length > 0) {
        const planData = result.rows[0]['QUERY PLAN'][0];
        return {
          plan: planData.Plan,
          executionTime: planData['Execution Time'],
          planningTime: planData['Planning Time'],
        };
      }
    } catch (error) {
      // EXPLAIN might fail for some query types (e.g., transactions)
      logger.debug('Failed to get query plan', { error });
    }
    return undefined;
  }

  /**
   * Analyze query plan for performance issues
   */
  private analyzeQueryPlan(queryPlan: QueryPlan | undefined): string[] {
    const recommendations: string[] = [];

    if (!queryPlan) {
      return recommendations;
    }

    const plan = queryPlan.plan;

    // Check for sequential scans
    if (this.containsSeqScan(plan)) {
      recommendations.push('Sequential scan detected - consider adding index on filtered columns');
    }

    // Check for high row counts
    if (plan['Actual Rows'] > 10000) {
      recommendations.push(`High row count (${plan['Actual Rows']}) - consider adding WHERE clause or pagination`);
    }

    // Check for expensive sorts
    if (plan['Node Type'] === 'Sort' && plan['Actual Total Time'] > 100) {
      recommendations.push('Expensive sort operation - consider adding index on sort columns');
    }

    // Check for nested loops with high iterations
    if (plan['Node Type'] === 'Nested Loop' && plan['Actual Loops'] > 1000) {
      recommendations.push('High nested loop iterations - consider adding join index or rewriting query');
    }

    return recommendations;
  }

  /**
   * Check if query plan contains sequential scan
   */
  private containsSeqScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') {
      return true;
    }

    if (plan.Plans) {
      return plan.Plans.some((subPlan: any) => this.containsSeqScan(subPlan));
    }

    return false;
  }

  /**
   * Extract query type (SELECT, INSERT, UPDATE, DELETE)
   */
  private extractQueryType(query: string): string {
    const normalized = query.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('WITH')) return 'WITH';
    return 'OTHER';
  }

  /**
   * Extract table name from query (best effort)
   */
  private extractTableName(query: string): string | null {
    const normalized = query.trim().toUpperCase();

    // Try to extract from SELECT ... FROM table
    let match = normalized.match(/FROM\s+["']?(\w+)["']?/);
    if (match) return match[1].toLowerCase();

    // Try to extract from INSERT INTO table
    match = normalized.match(/INSERT\s+INTO\s+["']?(\w+)["']?/);
    if (match) return match[1].toLowerCase();

    // Try to extract from UPDATE table
    match = normalized.match(/UPDATE\s+["']?(\w+)["']?/);
    if (match) return match[1].toLowerCase();

    // Try to extract from DELETE FROM table
    match = normalized.match(/DELETE\s+FROM\s+["']?(\w+)["']?/);
    if (match) return match[1].toLowerCase();

    return null;
  }

  /**
   * Sanitize query parameters for logging (mask sensitive data)
   */
  private sanitizeParams(params: any[] | undefined): string {
    if (!params || params.length === 0) {
      return '[]';
    }

    const sanitized = params.map((param, index) => {
      // Mask anything that looks like a password, token, or key
      const paramStr = String(param);
      if (paramStr.length > 20 && /^[A-Za-z0-9+/=]+$/.test(paramStr)) {
        return `[REDACTED_${index}]`;
      }
      // Truncate long strings
      if (typeof param === 'string' && param.length > 100) {
        return param.substring(0, 100) + '...';
      }
      return param;
    });

    return JSON.stringify(sanitized);
  }

  /**
   * Check slow query rate and alert if exceeds threshold
   */
  private checkSlowQueryRate(): void {
    if (this.totalQueryCount === 0) {
      return;
    }

    const slowQueryRate = this.slowQueryCount / this.totalQueryCount;

    if (slowQueryRate > SLOW_QUERY_RATE_ALERT_THRESHOLD) {
      const now = Date.now();
      // Rate limit alerts to avoid spam
      if (now - this.lastAlertTime > this.ALERT_COOLDOWN_MS) {
        logger.error('High slow query rate detected', {
          slow_query_count: this.slowQueryCount,
          total_query_count: this.totalQueryCount,
          slow_query_rate: (slowQueryRate * 100).toFixed(2) + '%',
          threshold: (SLOW_QUERY_RATE_ALERT_THRESHOLD * 100).toFixed(2) + '%',
          alert: 'SLOW_QUERY_RATE_EXCEEDED',
        });
        this.lastAlertTime = now;
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    const slowQueryRate = this.totalQueryCount > 0 
      ? (this.slowQueryCount / this.totalQueryCount) * 100
      : 0;

    return {
      totalQueries: this.totalQueryCount,
      slowQueries: this.slowQueryCount,
      slowQueryRate: slowQueryRate.toFixed(2) + '%',
      threshold: SLOW_QUERY_THRESHOLD_MS + 'ms',
    };
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.slowQueryCount = 0;
    this.totalQueryCount = 0;
    this.queryLogs = [];
  }
}

export const slowQueryMonitor = SlowQueryMonitorService.getInstance();
