/**
 * Resource Optimizer
 * Monitors table bloat, cache efficiency, vacuum statistics, and long-running
 * transactions to identify optimization opportunities and resource pressure.
 */

import pool from '../../config/database.js';

function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = '';
  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) text += '$' + (i + 1);
  });
  return pool.query(text, values as unknown[]).then((r) => r.rows as T[]);
}

export interface TableBloat {
  table: string;
  liveRows: number;
  deadRows: number;
  bloatRatio: number;
}

export interface CacheHitRate {
  table: string;
  heapHitRate: number;
  idxHitRate: number;
}

export interface LongRunningTransaction {
  pid: number;
  duration: string;
  state: string;
  query: string;
}

export interface VacuumStat {
  table: string;
  lastVacuum: string | null;
  lastAutoVacuum: string | null;
  lastAnalyze: string | null;
}

export interface TableSize {
  table: string;
  totalBytes: number;
  tableBytes: number;
  indexBytes: number;
  toastBytes: number;
  totalPretty: string;
}

export interface TableIoStat {
  table: string;
  heapBlksRead: number;
  heapBlksHit: number;
  heapCacheHitRatio: number;
  idxBlksRead: number;
  idxBlksHit: number;
  toastBlksRead: number;
  toastBlksHit: number;
}

export interface IndexBloatEstimate {
  table: string;
  index: string;
  totalBytes: number;
  liveRows: number;
  deadRows: number;
  bloatRatio: number;
}

export interface AutovacuumActivityEntry {
  table: string;
  lastVacuum: string | null;
  lastAutoVacuum: string | null;
  vacuumCount: number;
  autovacuumCount: number;
}

export class ResourceOptimizer {
  /**
   * #289 — Table bloat: dead-tuple ratio per table from pg_stat_user_tables.
   */
  async getTableBloat(): Promise<TableBloat[]> {
    const rows = await query<Array<{ relname: string; n_live_tup: bigint; n_dead_tup: bigint }>>`
      SELECT relname, n_live_tup, n_dead_tup
      FROM pg_stat_user_tables
      ORDER BY n_dead_tup DESC
      LIMIT 20
    `;
    return rows.map(r => {
      const live = Number(r.n_live_tup);
      const dead = Number(r.n_dead_tup);
      return { table: r.relname, liveRows: live, deadRows: dead, bloatRatio: live + dead > 0 ? dead / (live + dead) : 0 };
    });
  }

  /**
   * #290 — Buffer cache hit rates from pg_statio_user_tables.
   */
  async getCacheHitRate(): Promise<CacheHitRate[]> {
    const rows = await query<Array<{
      relname: string; heap_blks_hit: bigint; heap_blks_read: bigint; idx_blks_hit: bigint; idx_blks_read: bigint;
    }>>`
      SELECT relname, heap_blks_hit, heap_blks_read, idx_blks_hit, idx_blks_read
      FROM pg_statio_user_tables
      ORDER BY relname
    `;
    return rows.map(r => {
      const hh = Number(r.heap_blks_hit), hr = Number(r.heap_blks_read);
      const ih = Number(r.idx_blks_hit),  ir = Number(r.idx_blks_read);
      return {
        table: r.relname,
        heapHitRate: hh + hr > 0 ? hh / (hh + hr) : 1,
        idxHitRate:  ih + ir > 0 ? ih / (ih + ir) : 1,
      };
    });
  }

  /**
   * #291 — Long-running transactions from pg_stat_activity.
   */
  async getLongRunningTransactions(minDurationSec = 10): Promise<LongRunningTransaction[]> {
    const rows = await query<Array<{ pid: number; duration: string; state: string; query: string }>>`
      SELECT pid,
             (now() - xact_start)::text AS duration,
             state,
             left(query, 120) AS query
      FROM pg_stat_activity
      WHERE xact_start IS NOT NULL
        AND now() - xact_start > (${minDurationSec} || ' seconds')::interval
        AND state != 'idle'
      ORDER BY duration DESC
    `;
    return rows;
  }

  /**
   * #292 — Vacuum / analyse timestamps from pg_stat_user_tables.
   */
  async getVacuumStats(): Promise<VacuumStat[]> {
    const rows = await query<Array<{
      relname: string; last_vacuum: Date | null; last_autovacuum: Date | null; last_analyze: Date | null;
    }>>`
      SELECT relname, last_vacuum, last_autovacuum, last_analyze
      FROM pg_stat_user_tables
      ORDER BY relname
    `;
    return rows.map(r => ({
      table: r.relname,
      lastVacuum:     r.last_vacuum    ? r.last_vacuum.toISOString()    : null,
      lastAutoVacuum: r.last_autovacuum ? r.last_autovacuum.toISOString() : null,
      lastAnalyze:    r.last_analyze   ? r.last_analyze.toISOString()   : null,
    }));
  }

  /**
   * #294a — Per-table I/O statistics from pg_statio_user_tables.
   */
  async getTableIoStats(limit = 30): Promise<TableIoStat[]> {
    const rows = await query<Array<{
      relname: string;
      heap_blks_read: bigint;
      heap_blks_hit: bigint;
      idx_blks_read: bigint;
      idx_blks_hit: bigint;
      toast_blks_read: bigint | null;
      toast_blks_hit: bigint | null;
    }>>`
      SELECT
        relname,
        heap_blks_read,
        heap_blks_hit,
        COALESCE(idx_blks_read, 0)   AS idx_blks_read,
        COALESCE(idx_blks_hit,  0)   AS idx_blks_hit,
        COALESCE(toast_blks_read, 0) AS toast_blks_read,
        COALESCE(toast_blks_hit,  0) AS toast_blks_hit
      FROM pg_statio_user_tables
      ORDER BY heap_blks_read + COALESCE(idx_blks_read, 0) DESC
      LIMIT ${limit}
    `;
    return rows.map(r => {
      const heapRead = Number(r.heap_blks_read);
      const heapHit  = Number(r.heap_blks_hit);
      return {
        table:              r.relname,
        heapBlksRead:       heapRead,
        heapBlksHit:        heapHit,
        heapCacheHitRatio:  heapRead + heapHit > 0 ? heapHit / (heapRead + heapHit) : 1,
        idxBlksRead:        Number(r.idx_blks_read),
        idxBlksHit:         Number(r.idx_blks_hit),
        toastBlksRead:      Number(r.toast_blks_read),
        toastBlksHit:       Number(r.toast_blks_hit),
      };
    });
  }

  /**
   * #278b — Top tables by total on-disk size with row-count estimates.
   */
  async getTableSizes(limit = 30): Promise<TableSize[]> {
    const rows = await query<Array<{
      relname: string;
      total_pretty: string;
      total_bytes: bigint;
      table_bytes: bigint;
      index_bytes: bigint;
      toast_bytes: bigint;
    }>>`
      SELECT
        relname,
        pg_size_pretty(pg_total_relation_size(oid))    AS total_pretty,
        pg_total_relation_size(oid)                    AS total_bytes,
        pg_relation_size(oid)                          AS table_bytes,
        pg_indexes_size(oid)                           AS index_bytes,
        COALESCE(pg_total_relation_size(reltoastrelid), 0) AS toast_bytes
      FROM pg_class
      WHERE relkind = 'r'
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY total_bytes DESC
      LIMIT ${limit}
    `;
    return rows.map(r => ({
      table:       r.relname,
      totalBytes:  Number(r.total_bytes),
      tableBytes:  Number(r.table_bytes),
      indexBytes:  Number(r.index_bytes),
      toastBytes:  Number(r.toast_bytes),
      totalPretty: r.total_pretty,
    }));
  }

  /**
   * #280a — Index bloat estimate from pg_class size calculations.
   */
  async getIndexBloatEstimate(limit = 20): Promise<IndexBloatEstimate[]> {
    const rows = await query<Array<{
      relname: string;
      indexrelname: string;
      total_bytes: bigint;
      n_live_tup: bigint;
      n_dead_tup: bigint;
    }>>`
      SELECT
        t.relname,
        i.relname AS indexrelname,
        pg_relation_size(i.oid) AS total_bytes,
        COALESCE(s.n_live_tup, 0) AS n_live_tup,
        COALESCE(s.n_dead_tup, 0) AS n_dead_tup
      FROM pg_index AS ix
      JOIN pg_class AS t ON t.oid = ix.indrelid
      JOIN pg_class AS i ON i.oid = ix.indexrelid
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.relname
      ORDER BY total_bytes DESC
      LIMIT ${limit}
    `;
    return rows.map(r => {
      const live = Number(r.n_live_tup);
      const dead = Number(r.n_dead_tup);
      return {
        table: r.relname,
        index: r.indexrelname,
        totalBytes: Number(r.total_bytes),
        liveRows: live,
        deadRows: dead,
        bloatRatio: live + dead > 0 ? dead / (live + dead) : 0,
      };
    });
  }

  /**
   * Autovacuum activity monitoring.
   */
  async getAutovacuumActivity(): Promise<AutovacuumActivityEntry[]> {
    const rows = await query<Array<{
      relname: string;
      last_vacuum: Date | null;
      last_autovacuum: Date | null;
      vacuum_count: bigint;
      autovacuum_count: bigint;
    }>>`
      SELECT
        relname,
        last_vacuum,
        last_autovacuum,
        vacuum_count,
        autovacuum_count
      FROM pg_stat_user_tables
      ORDER BY autovacuum_count DESC
      LIMIT 20
    `;
    return rows.map(r => ({
      table: r.relname,
      lastVacuum: r.last_vacuum ? r.last_vacuum.toISOString() : null,
      lastAutoVacuum: r.last_autovacuum ? r.last_autovacuum.toISOString() : null,
      vacuumCount: Number(r.vacuum_count),
      autovacuumCount: Number(r.autovacuum_count),
    }));
  }
}
