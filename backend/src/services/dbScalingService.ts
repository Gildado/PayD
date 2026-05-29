import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

export interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
}

export interface QueryResult<T> {
  data: T;
  durationMs: number;
  fromCache: boolean;
}

const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 20);
const POOL_MIN = Number(process.env.DB_POOL_MIN ?? 2);

let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    prismaInstance.$on('warn' as never, (e: unknown) => {
      logger.warn({ event: e }, 'Prisma warning');
    });

    prismaInstance.$on('error' as never, (e: unknown) => {
      logger.error({ event: e }, 'Prisma error');
    });
  }
  return prismaInstance;
}

export class DbScalingService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async getPoolStats(): Promise<PoolStats> {
    const result = await this.prisma.$queryRaw<
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

  async runHealthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      logger.error({ err }, 'DB health check failed');
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async getSlowQueries(
    thresholdMs = 1000,
    limit = 20,
  ): Promise<Array<{ query: string; calls: number; avgMs: number; totalMs: number }>> {
    const rows = await this.prisma.$queryRaw<
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

  async getIndexUsage(): Promise<
    Array<{ table: string; index: string; scans: number; tuplesRead: number }>
  > {
    const rows = await this.prisma.$queryRaw<
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

  getPoolConfig(): { min: number; max: number } {
    return { min: POOL_MIN, max: POOL_MAX };
  }

  /** #289 — Table bloat: dead-tuple ratio per table from pg_stat_user_tables. */
  async getTableBloat(): Promise<{ table: string; liveRows: number; deadRows: number; bloatRatio: number }[]> {
    const rows = await this.prisma.$queryRaw<Array<{ relname: string; n_live_tup: bigint; n_dead_tup: bigint }>>`
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

  /** #290 — Buffer cache hit rates from pg_statio_user_tables. */
  async getCacheHitRate(): Promise<{ table: string; heapHitRate: number; idxHitRate: number }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
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

  /** #291 — Long-running transactions from pg_stat_activity. */
  async getLongRunningTransactions(minDurationSec = 10): Promise<{ pid: number; duration: string; state: string; query: string }[]> {
    const rows = await this.prisma.$queryRaw<Array<{ pid: number; duration: string; state: string; query: string }>>`
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

  /** #292 — Vacuum / analyse timestamps from pg_stat_user_tables. */
  async getVacuumStats(): Promise<{ table: string; lastVacuum: string | null; lastAutoVacuum: string | null; lastAnalyze: string | null }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
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

  // ── Part 37 (#282) ───────────────────────────────────────────────────────

  /**
   * #282a — Connection breakdown: active connections grouped by state and
   * application name from pg_stat_activity.
   */
  async getConnectionBreakdown(): Promise<{
    state: string;
    applicationName: string;
    count: number;
  }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
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
  async getDbSettings(): Promise<{
    name: string;
    setting: string;
    unit: string | null;
    category: string;
  }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      name: string;
      setting: string;
      unit: string | null;
      category: string;
    }>>`
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
    return rows.map(r => ({
      name:     r.name,
      setting:  r.setting,
      unit:     r.unit,
      category: r.category,
    }));
  }

  // ── Part 38 (#283) ───────────────────────────────────────────────────────

  /**
   * #283a — Sequential scan stats: tables where seq_scan dominates idx_scan,
   * indicating missing or unused indexes.
   */
  async getSeqScanStats(limit = 20): Promise<{
    table: string;
    seqScans: number;
    idxScans: number;
    seqTupRead: number;
    idxTupFetch: number;
    seqScanRatio: number;
  }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
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
   * #283b — WAL generation statistics from pg_stat_wal.
   * Returns cumulative WAL bytes written and record counts since last reset.
   */
  async getWalStats(): Promise<{
    walRecords: number;
    walFpi: number;
    walBytes: number;
    walBuffersFull: number;
    walWrite: number;
    walSync: number;
    walWriteTimeMs: number;
    walSyncTimeMs: number;
  }> {
    const rows = await this.prisma.$queryRaw<Array<{
      wal_records: bigint;
      wal_fpi: bigint;
      wal_bytes: bigint;
      wal_buffers_full: bigint;
      wal_write: bigint;
      wal_sync: bigint;
      wal_write_time: number;
      wal_sync_time: number;
    }>>`
      SELECT wal_records, wal_fpi, wal_bytes, wal_buffers_full,
             wal_write, wal_sync, wal_write_time, wal_sync_time
      FROM pg_stat_wal
    `;
    const r = rows[0] ?? {
      wal_records: 0n, wal_fpi: 0n, wal_bytes: 0n, wal_buffers_full: 0n,
      wal_write: 0n, wal_sync: 0n, wal_write_time: 0, wal_sync_time: 0,
    };
    return {
      walRecords:       Number(r.wal_records),
      walFpi:           Number(r.wal_fpi),
      walBytes:         Number(r.wal_bytes),
      walBuffersFull:   Number(r.wal_buffers_full),
      walWrite:         Number(r.wal_write),
      walSync:          Number(r.wal_sync),
      walWriteTimeMs:   Math.round(r.wal_write_time / 1000),
      walSyncTimeMs:    Math.round(r.wal_sync_time / 1000),
    };
  }

  // ── Part 42 (#287) ───────────────────────────────────────────────────────

  /**
   * #287a — Background writer and checkpoint statistics from pg_stat_bgwriter.
   * Surfaces checkpoint frequency, buffer writes, and allocation counts.
   */
  async getBgwriterStats(): Promise<{
    checkpointsTimed: number;
    checkpointsReq: number;
    checkpointWriteTimeMs: number;
    checkpointSyncTimeMs: number;
    buffersCheckpoint: number;
    buffersClean: number;
    maxwrittenClean: number;
    buffersBackend: number;
    buffersBackendFsync: number;
    buffersAlloc: number;
  }> {
    const rows = await this.prisma.$queryRaw<Array<{
      checkpoints_timed: bigint;
      checkpoints_req: bigint;
      checkpoint_write_time: number;
      checkpoint_sync_time: number;
      buffers_checkpoint: bigint;
      buffers_clean: bigint;
      maxwritten_clean: bigint;
      buffers_backend: bigint;
      buffers_backend_fsync: bigint;
      buffers_alloc: bigint;
    }>>`
      SELECT checkpoints_timed, checkpoints_req,
             checkpoint_write_time, checkpoint_sync_time,
             buffers_checkpoint, buffers_clean, maxwritten_clean,
             buffers_backend, buffers_backend_fsync, buffers_alloc
      FROM pg_stat_bgwriter
    `;
    const r = rows[0] ?? {
      checkpoints_timed: 0n, checkpoints_req: 0n, checkpoint_write_time: 0,
      checkpoint_sync_time: 0, buffers_checkpoint: 0n, buffers_clean: 0n,
      maxwritten_clean: 0n, buffers_backend: 0n, buffers_backend_fsync: 0n,
      buffers_alloc: 0n,
    };
    return {
      checkpointsTimed:      Number(r.checkpoints_timed),
      checkpointsReq:        Number(r.checkpoints_req),
      checkpointWriteTimeMs: Math.round(r.checkpoint_write_time),
      checkpointSyncTimeMs:  Math.round(r.checkpoint_sync_time),
      buffersCheckpoint:     Number(r.buffers_checkpoint),
      buffersClean:          Number(r.buffers_clean),
      maxwrittenClean:       Number(r.maxwritten_clean),
      buffersBackend:        Number(r.buffers_backend),
      buffersBackendFsync:   Number(r.buffers_backend_fsync),
      buffersAlloc:          Number(r.buffers_alloc),
    };
  }

  /**
   * #287b — Temporary file usage per database from pg_stat_database.
   * High temp_bytes indicates queries spilling to disk due to memory pressure.
   */
  async getTempFileUsage(): Promise<{
    database: string;
    tempFiles: number;
    tempBytes: number;
    tempBytesPretty: string;
  }> {
    const rows = await this.prisma.$queryRaw<Array<{
      datname: string;
      temp_files: bigint;
      temp_bytes: bigint;
      temp_bytes_pretty: string;
    }>>`
      SELECT datname, temp_files, temp_bytes,
             pg_size_pretty(temp_bytes) AS temp_bytes_pretty
      FROM pg_stat_database
      WHERE datname = current_database()
    `;
    const r = rows[0] ?? { datname: '', temp_files: 0n, temp_bytes: 0n, temp_bytes_pretty: '0 bytes' };
    return {
      database:        r.datname,
      tempFiles:       Number(r.temp_files),
      tempBytes:       Number(r.temp_bytes),
      tempBytesPretty: r.temp_bytes_pretty,
    };
  }

  // ── Part 50 (#295) ───────────────────────────────────────────────────────

  /**
   * #295a — Database-wide transaction and conflict statistics.
   * Includes xact_commit/rollback counts, deadlocks, and temp usage for
   * capacity planning and wraparound risk assessment.
   */
  async getDatabaseStats(): Promise<{
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
  }> {
    const rows = await this.prisma.$queryRaw<Array<{
      datname: string;
      numbackends: number;
      xact_commit: bigint;
      xact_rollback: bigint;
      blks_read: bigint;
      blks_hit: bigint;
      deadlocks: bigint;
      temp_files: bigint;
      temp_bytes: bigint;
    }>>`
      SELECT datname, numbackends, xact_commit, xact_rollback,
             blks_read, blks_hit, deadlocks, temp_files, temp_bytes
      FROM pg_stat_database
      WHERE datname = current_database()
    `;
    const r = rows[0] ?? {
      datname: '', numbackends: 0, xact_commit: 0n, xact_rollback: 0n,
      blks_read: 0n, blks_hit: 0n, deadlocks: 0n, temp_files: 0n, temp_bytes: 0n,
    };
    const read = Number(r.blks_read);
    const hit  = Number(r.blks_hit);
    return {
      database:      r.datname,
      numBackends:   r.numbackends,
      xactCommit:    Number(r.xact_commit),
      xactRollback:  Number(r.xact_rollback),
      blksRead:      read,
      blksHit:       hit,
      cacheHitRatio: read + hit > 0 ? hit / (read + hit) : 1,
      deadlocks:     Number(r.deadlocks),
      tempFiles:     Number(r.temp_files),
      tempBytes:     Number(r.temp_bytes),
    };
  }

  /**
   * #295b — Block I/O timing statistics from pg_stat_database.
   * Surfaces cumulative read/write time for diagnosing storage bottlenecks.
   */
  async getBlockIoStats(): Promise<{
    database: string;
    blkReadTimeMs: number;
    blkWriteTimeMs: number;
    sessionTimeMs: number;
    activeTimeMs: number;
    idleInTransactionTimeMs: number;
  }> {
    const rows = await this.prisma.$queryRaw<Array<{
      datname: string;
      blk_read_time: number;
      blk_write_time: number;
      session_time: number;
      active_time: number;
      idle_in_transaction_time: number;
    }>>`
      SELECT datname, blk_read_time, blk_write_time,
             session_time, active_time, idle_in_transaction_time
      FROM pg_stat_database
      WHERE datname = current_database()
    `;
    const r = rows[0] ?? {
      datname: '', blk_read_time: 0, blk_write_time: 0,
      session_time: 0, active_time: 0, idle_in_transaction_time: 0,
    };
    return {
      database:                  r.datname,
      blkReadTimeMs:             Math.round(r.blk_read_time),
      blkWriteTimeMs:            Math.round(r.blk_write_time),
      sessionTimeMs:             Math.round(r.session_time),
      activeTimeMs:              Math.round(r.active_time),
      idleInTransactionTimeMs:   Math.round(r.idle_in_transaction_time),
    };
  }

  // ── Part 39 (#284) ───────────────────────────────────────────────────────

  /**
   * #284a — Lock contention: active waits from pg_locks joined to pg_stat_activity.
   * Returns rows where one backend is blocking another, showing both PIDs,
   * the lock type, and the waiting query (truncated to 120 chars).
   */
  async getLockContention(): Promise<{
    waitingPid: number;
    blockingPid: number;
    lockType: string;
    relation: string | null;
    waitingQuery: string;
    waitDuration: string | null;
  }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      waiting_pid: number;
      blocking_pid: number;
      locktype: string;
      relation: string | null;
      waiting_query: string;
      wait_duration: string | null;
    }>>`
      SELECT
        blocked.pid                          AS waiting_pid,
        blocking.pid                         AS blocking_pid,
        blocked_locks.locktype,
        blocked_locks.relation::regclass::text AS relation,
        left(blocked_activity.query, 120)    AS waiting_query,
        (now() - blocked_activity.query_start)::text AS wait_duration
      FROM pg_locks AS blocked_locks
      JOIN pg_stat_activity AS blocked_activity
        ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_locks AS blocking_locks
        ON  blocking_locks.locktype  = blocked_locks.locktype
        AND blocking_locks.database  IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation  IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page      IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple     IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.classid   IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid     IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid  IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_stat_activity AS blocking
        ON blocking.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
      ORDER BY wait_duration DESC NULLS LAST
    `;
    return rows.map(r => ({
      waitingPid:   r.waiting_pid,
      blockingPid:  r.blocking_pid,
      lockType:     r.locktype,
      relation:     r.relation,
      waitingQuery: r.waiting_query,
      waitDuration: r.wait_duration,
    }));
  }

  /**
   * #284b — Unused indexes: user indexes with zero scans since last stats reset.
   * Useful for identifying bloat from indexes that are never hit by queries.
   */
  async getUnusedIndexes(): Promise<{
    table: string;
    index: string;
    indexSizeBytes: number;
  }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
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

  // ── Part 40 (#285) ───────────────────────────────────────────────────────

  /**
   * #285a — Replication lag: bytes behind primary for each standby replica.
   * Returns an empty array when no replicas are configured (not an error).
   */
  async getReplicationLag(): Promise<{
    clientAddr: string | null;
    state: string;
    sentLsn: string;
    writeLsn: string;
    flushLsn: string;
    replayLsn: string;
    writeLagBytes: number;
    flushLagBytes: number;
    replayLagBytes: number;
  }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      client_addr: string | null;
      state: string;
      sent_lsn: string;
      write_lsn: string;
      flush_lsn: string;
      replay_lsn: string;
      write_lag_bytes: bigint;
      flush_lag_bytes: bigint;
      replay_lag_bytes: bigint;
    }>>`
      SELECT
        client_addr::text,
        state,
        sent_lsn::text,
        write_lsn::text,
        flush_lsn::text,
        replay_lsn::text,
        (sent_lsn - write_lsn)  AS write_lag_bytes,
        (sent_lsn - flush_lsn)  AS flush_lag_bytes,
        (sent_lsn - replay_lsn) AS replay_lag_bytes
      FROM pg_stat_replication
      ORDER BY replay_lag_bytes DESC
    `;
    return rows.map(r => ({
      clientAddr:      r.client_addr,
      state:           r.state,
      sentLsn:         r.sent_lsn,
      writeLsn:        r.write_lsn,
      flushLsn:        r.flush_lsn,
      replayLsn:       r.replay_lsn,
      writeLagBytes:   Number(r.write_lag_bytes),
      flushLagBytes:   Number(r.flush_lag_bytes),
      replayLagBytes:  Number(r.replay_lag_bytes),
    }));
  }

  /**
   * #285b — Table sizes: total on-disk size (table + indexes + TOAST) per table,
   * ordered largest first.  Useful for capacity planning and spotting unexpected growth.
   */
  async getTableSizes(limit = 30): Promise<{
    table: string;
    totalBytes: number;
    tableBytes: number;
    indexBytes: number;
    toastBytes: number;
    totalPretty: string;
  }[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      relname: string;
      total_bytes: bigint;
      table_bytes: bigint;
      index_bytes: bigint;
      toast_bytes: bigint;
      total_pretty: string;
    }>>`
      SELECT
        relname,
        pg_total_relation_size(oid)                    AS total_bytes,
        pg_relation_size(oid)                          AS table_bytes,
        pg_indexes_size(oid)                           AS index_bytes,
        COALESCE(pg_total_relation_size(reltoastrelid), 0) AS toast_bytes,
        pg_size_pretty(pg_total_relation_size(oid))    AS total_pretty
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
}
