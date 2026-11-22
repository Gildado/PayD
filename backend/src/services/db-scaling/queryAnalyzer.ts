/**
 * Query Analyzer
 * Analyzes query performance, execution patterns, and index usage to identify
 * optimization opportunities and slow queries.
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

export interface SlowQuery {
  query: string;
  calls: number;
  avgMs: number;
  totalMs: number;
}

export interface IndexUsage {
  table: string;
  index: string;
  scans: number;
  tuplesRead: number;
}

export interface IndexUsageStats {
  table: string;
  index: string;
  idxScan: number;
  idxTupRead: number;
  idxTupFetch: number;
}

export interface SeqScanStat {
  table: string;
  seqScans: number;
  idxScans: number;
  seqTupRead: number;
  idxTupFetch: number;
  seqScanRatio: number;
}

export interface UnusedIndex {
  table: string;
  index: string;
  indexSizeBytes: number;
}

export interface QueryPlanCacheEntry {
  queryHash: string;
  queryText: string;
  planCalls: number;
  planResets: number;
  lastPlanReset: string | null;
  recordedAt: string;
}

export interface SlowQueryAggregate {
  query: string;
  callCount: number;
  avgDurationMs: number;
}

export class QueryAnalyzer {
  /**
   * Find slow queries from pg_stat_statements that exceed the threshold.
   * Useful for identifying performance bottlenecks.
   */
  async getSlowQueries(
    thresholdMs = 1000,
    limit = 20,
  ): Promise<SlowQuery[]> {
    const rows = await query<
      Array<{ query: string; calls: bigint; mean_exec_time: number; total_exec_time: number }>
    >`
      SELECT query, calls, mean_exec_time, total_exec_time
      FROM pg_stat_statements
      WHERE mean_exec_time > ${thresholdMs}
        AND query NOT LIKE '%pg_stat%'
      ORDER BY mean_exec_time DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      query: r.query,
      calls: Number(r.calls),
      avgMs: Math.round(r.mean_exec_time),
      totalMs: Math.round(r.total_exec_time),
    }));
  }

  /**
   * Aggregate slow queries by pattern for performance trending.
   */
  async getSlowQueryAggregates(windowMinutes = 60, limit = 20): Promise<SlowQueryAggregate[]> {
    const rows = await query<Array<{
      query: string;
      call_count: bigint;
      avg_duration_ms: number;
    }>>`
      SELECT query, calls as call_count, mean_exec_time as avg_duration_ms
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat%'
      ORDER BY mean_exec_time DESC
      LIMIT ${limit}
    `;

    return rows.map(r => ({
      query: r.query,
      callCount: Number(r.call_count),
      avgDurationMs: Math.round(r.avg_duration_ms),
    }));
  }

  /**
   * #283a — Sequential scan stats: tables where seq_scan dominates idx_scan,
   * indicating missing or unused indexes.
   */
  async getSeqScanStats(limit = 20): Promise<SeqScanStat[]> {
    const rows = await query<Array<{
      relname: string;
      seq_scan: bigint;
      idx_scan: bigint;
      seq_tup_read: bigint;
      idx_tup_fetch: bigint;
    }>>`
      SELECT relname, seq_scan, idx_scan, seq_tup_read, idx_tup_fetch
      FROM pg_stat_user_tables
      WHERE seq_scan > 0
      ORDER BY seq_scan DESC
      LIMIT ${limit}
    `;
    return rows.map(r => {
      const seq = Number(r.seq_scan);
      const idx = Number(r.idx_scan);
      return {
        table:        r.relname,
        seqScans:     seq,
        idxScans:     idx,
        seqTupRead:   Number(r.seq_tup_read),
        idxTupFetch:  Number(r.idx_tup_fetch),
        seqScanRatio: seq + idx > 0 ? seq / (seq + idx) : 0,
      };
    });
  }

  /**
   * #284b — Unused indexes: user indexes with zero scans since last stats reset.
   * Useful for identifying bloat from indexes that are never hit by queries.
   */
  async getUnusedIndexes(): Promise<UnusedIndex[]> {
    const rows = await query<Array<{
      relname: string;
      indexrelname: string;
      index_size: bigint;
    }>>`
      SELECT
        t.relname,
        i.relname AS indexrelname,
        pg_relation_size(i.oid) AS index_size
      FROM pg_index AS ix
      JOIN pg_class AS t ON t.oid = ix.indrelid
      JOIN pg_class AS i ON i.oid = ix.indexrelid
      JOIN pg_stat_user_indexes AS s
        ON s.indexrelid = ix.indexrelid
      WHERE s.idx_scan = 0
        AND NOT ix.indisprimary
        AND NOT ix.indisunique
      ORDER BY index_size DESC
      LIMIT 50
    `;
    return rows.map(r => ({
      table:          r.relname,
      index:          r.indexrelname,
      indexSizeBytes: Number(r.index_size),
    }));
  }

  /**
   * Get index usage statistics from pg_stat_user_indexes.
   */
  async getIndexUsage(): Promise<IndexUsage[]> {
    const rows = await query<
      Array<{
        relname: string;
        indexrelname: string;
        idx_scan: bigint;
        idx_tup_read: bigint;
      }>
    >`
      SELECT relname, indexrelname, idx_scan, idx_tup_read
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 50
    `;

    return rows.map((r) => ({
      table: r.relname,
      index: r.indexrelname,
      scans: Number(r.idx_scan),
      tuplesRead: Number(r.idx_tup_read),
    }));
  }

  /**
   * #294b — Per-index access statistics from pg_stat_user_indexes.
   */
  async getIndexUsageStats(limit = 30): Promise<IndexUsageStats[]> {
    const rows = await query<Array<{
      relname: string;
      indexrelname: string;
      idx_scan: bigint;
      idx_tup_read: bigint;
      idx_tup_fetch: bigint;
    }>>`
      SELECT
        relname,
        indexrelname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT ${limit}
    `;
    return rows.map(r => ({
      table:        r.relname,
      index:        r.indexrelname,
      idxScan:      Number(r.idx_scan),
      idxTupRead:   Number(r.idx_tup_read),
      idxTupFetch:  Number(r.idx_tup_fetch),
    }));
  }

  /**
   * #278a — Query plan cache: surfaces prepared-statement plan invalidations.
   */
  async getQueryPlanCache(limit = 20): Promise<QueryPlanCacheEntry[]> {
    const rows = await query<Array<{
      query_hash: string;
      query_text: string;
      plan_calls: bigint;
      plan_resets: bigint;
      last_plan_reset: Date | null;
      recorded_at: Date;
    }>>`
      SELECT query_hash, query_text, plan_calls, plan_resets,
             last_plan_reset, recorded_at
      FROM db_query_plan_cache
      ORDER BY plan_resets DESC, recorded_at DESC
      LIMIT ${limit}
    `;
    return rows.map(r => ({
      queryHash:     r.query_hash,
      queryText:     r.query_text,
      planCalls:     Number(r.plan_calls),
      planResets:    Number(r.plan_resets),
      lastPlanReset: r.last_plan_reset ? r.last_plan_reset.toISOString() : null,
      recordedAt:    r.recorded_at.toISOString(),
    }));
  }
}
