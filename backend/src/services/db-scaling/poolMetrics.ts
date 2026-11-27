/**
 * Pool Metrics Collector
 * Extracts connection pool statistics and configuration from pg_stat_activity
 * and pg_settings for capacity planning and health monitoring.
 */

import pool from '../../config/database.js';

const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 20);
const POOL_MIN = Number(process.env.DB_POOL_MIN ?? 2);

// Tagged-template helper that mirrors Prisma's $queryRaw<T>`SQL` API
function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = '';
  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) text += '$' + (i + 1);
  });
  return pool.query(text, values as unknown[]).then((r) => r.rows as T[]);
}

export interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
}

export interface ConnectionBreakdown {
  state: string;
  applicationName: string;
  count: number;
}

export interface DbSetting {
  name: string;
  setting: string;
  unit: string | null;
  category: string;
}

export class PoolMetricsCollector {
  async getPoolStats(): Promise<PoolStats> {
    const result = await query<
      Array<{ active: bigint; idle: bigint; waiting: bigint }>
    >`
      SELECT
        count(*) FILTER (WHERE state = 'active')  AS active,
        count(*) FILTER (WHERE state = 'idle')    AS idle,
        count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    const row = result[0] ?? { active: 0n, idle: 0n, waiting: 0n };
    return {
      activeConnections: Number(row.active),
      idleConnections: Number(row.idle),
      waitingRequests: Number(row.waiting),
      maxConnections: POOL_MAX,
    };
  }

  getPoolConfig(): { min: number; max: number } {
    return { min: POOL_MIN, max: POOL_MAX };
  }

  /**
   * #282a — Connection breakdown: active connections grouped by state and
   * application name from pg_stat_activity.
   */
  async getConnectionBreakdown(): Promise<ConnectionBreakdown[]> {
    const rows = await query<Array<{
      state: string;
      application_name: string;
      cnt: bigint;
    }>>`
      SELECT
        COALESCE(state, 'unknown')           AS state,
        COALESCE(application_name, '')       AS application_name,
        count(*)                             AS cnt
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state, application_name
      ORDER BY cnt DESC
    `;
    return rows.map(r => ({
      state:           r.state,
      applicationName: r.application_name,
      count:           Number(r.cnt),
    }));
  }

  /**
   * #282b — Scaling-relevant database settings from pg_settings.
   * Returns a curated subset of parameters that affect connection pooling,
   * memory, and query performance.
   */
  async getDbSettings(): Promise<DbSetting[]> {
    const rows = await query<Array<DbSetting>>`
      SELECT name, setting, unit, category
      FROM pg_settings
      WHERE name IN (
        'max_connections',
        'shared_buffers',
        'work_mem',
        'maintenance_work_mem',
        'effective_cache_size',
        'random_page_cost',
        'seq_page_cost',
        'max_wal_size',
        'min_wal_size',
        'checkpoint_completion_target',
        'autovacuum_vacuum_scale_factor',
        'autovacuum_analyze_scale_factor',
        'statement_timeout',
        'idle_in_transaction_session_timeout',
        'lock_timeout'
      )
      ORDER BY name
    `;
    return rows;
  }

  /**
   * #278d — Idle-in-transaction session timeout: reads the current setting
   * from pg_settings so operators can verify migration 047 was applied.
   */
  async getIdleInTransactionTimeout(): Promise<{
    setting: string;
    unit: string | null;
    source: string;
  }> {
    const rows = await query<Array<{
      setting: string;
      unit: string | null;
      source: string;
    }>>`
      SELECT setting, unit, source
      FROM pg_settings
      WHERE name = 'idle_in_transaction_session_timeout'
    `;
    const r = rows[0] ?? { setting: '0', unit: null, source: 'default' };
    return { setting: r.setting, unit: r.unit, source: r.source };
  }
}
