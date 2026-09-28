import pool from '../config/database.js';
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

// Tagged-template helper that mirrors Prisma's $queryRaw<T>`SQL` API.
// Uses the existing pg pool – no Prisma client needed.
function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = '';
  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) text += '$' + (i + 1);
  });
  return pool.query(text, values as unknown[]).then((r) => r.rows as T[]);
}


export class DbScalingService {

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

  async runHealthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await pool.query('SELECT 1');
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

  async getIndexUsage(): Promise<
    Array<{ table: string; index: string; scans: number; tuplesRead: number }>
  > {
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

  getPoolConfig(): { min: number; max: number } {
    return { min: POOL_MIN, max: POOL_MAX };
  }

  /** #289 — Table bloat: dead-tuple ratio per table from pg_stat_user_tables. */
  async getTableBloat(): Promise<{ table: string; liveRows: number; deadRows: number; bloatRatio: number }[]> {
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

  /** #290 — Buffer cache hit rates from pg_statio_user_tables. */
  async getCacheHitRate(): Promise<{ table: string; heapHitRate: number; idxHitRate: number }[]> {
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

  /** #291 — Long-running transactions from pg_stat_activity. */
  async getLongRunningTransactions(minDurationSec = 10): Promise<{ pid: number; duration: string; state: string; query: string }[]> {
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

  /** #292 — Vacuum / analyse timestamps from pg_stat_user_tables. */
  async getVacuumStats(): Promise<{ table: string; lastVacuum: string | null; lastAutoVacuum: string | null; lastAnalyze: string | null }[]> {
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
  async getDbSettings(): Promise<{
    name: string;
    setting: string;
    unit: string | null;
    category: string;
  }[]> {
    const rows = await query<Array<{
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
    const rows = await query<Array<{
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
    const rows = await query<Array<{
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
    const rows = await query<Array<{
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
    const rows = await query<Array<{
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
    const rows = await query<Array<{
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
    const rows = await query<Array<{
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
    const rows = await query<Array<{
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

  // ── Part 41 (#286) ───────────────────────────────────────────────────────

  /**
   * #286a — Background writer / checkpoint activity from pg_stat_bgwriter.
   * Surfaces checkpoint frequency, buffer write counts, and stall time so
   * operators can tune checkpoint_completion_target and bgwriter settings.
   */
  async getBgwriterStats(): Promise<{
    checkpointsTimed: number;
    checkpointsRequested: number;
    buffersCheckpoint: number;
    buffersClean: number;
    maxWrittenClean: number;
    buffersBackend: number;
    buffersBackendFsync: number;
    buffersAlloc: number;
    checkpointWriteTimeMs: number;
    checkpointSyncTimeMs: number;
    statsResetAt: string | null;
  }> {
    const rows = await query<Array<{
      checkpoints_timed: bigint;
      checkpoints_req: bigint;
      buffers_checkpoint: bigint;
      buffers_clean: bigint;
      maxwritten_clean: bigint;
      buffers_backend: bigint;
      buffers_backend_fsync: bigint;
      buffers_alloc: bigint;
      checkpoint_write_time: number;
      checkpoint_sync_time: number;
      stats_reset: Date | null;
    }>>`
      SELECT
        checkpoints_timed,
        checkpoints_req,
        buffers_checkpoint,
        buffers_clean,
        maxwritten_clean,
        buffers_backend,
        buffers_backend_fsync,
        buffers_alloc,
        checkpoint_write_time,
        checkpoint_sync_time,
        stats_reset
      FROM pg_stat_bgwriter
    `;
    const r = rows[0];
    if (!r) {
      return {
        checkpointsTimed: 0, checkpointsRequested: 0,
        buffersCheckpoint: 0, buffersClean: 0, maxWrittenClean: 0,
        buffersBackend: 0, buffersBackendFsync: 0, buffersAlloc: 0,
        checkpointWriteTimeMs: 0, checkpointSyncTimeMs: 0, statsResetAt: null,
      };
    }
    return {
      checkpointsTimed:     Number(r.checkpoints_timed),
      checkpointsRequested: Number(r.checkpoints_req),
      buffersCheckpoint:    Number(r.buffers_checkpoint),
      buffersClean:         Number(r.buffers_clean),
      maxWrittenClean:      Number(r.maxwritten_clean),
      buffersBackend:       Number(r.buffers_backend),
      buffersBackendFsync:  Number(r.buffers_backend_fsync),
      buffersAlloc:         Number(r.buffers_alloc),
      checkpointWriteTimeMs: r.checkpoint_write_time,
      checkpointSyncTimeMs:  r.checkpoint_sync_time,
      statsResetAt: r.stats_reset ? r.stats_reset.toISOString() : null,
    };
  }

  /**
   * #286b — Database-level statistics from pg_stat_database for the current DB.
   * Provides transaction throughput, cache hit ratio, deadlock counts, and
   * temporary file usage in a single snapshot.
   */
  async getDatabaseStats(): Promise<{
    dbName: string;
    numBackends: number;
    xactCommit: number;
    xactRollback: number;
    blksRead: number;
    blksHit: number;
    cacheHitRatio: number;
    tempFiles: number;
    tempBytes: number;
    deadlocks: number;
    conflictsTotal: number;
    statsResetAt: string | null;
  }> {
    const rows = await query<Array<{
      datname: string;
      numbackends: number;
      xact_commit: bigint;
      xact_rollback: bigint;
      blks_read: bigint;
      blks_hit: bigint;
      temp_files: bigint;
      temp_bytes: bigint;
      deadlocks: bigint;
      conflicts: bigint;
      stats_reset: Date | null;
    }>>`
      SELECT
        datname,
        numbackends,
        xact_commit,
        xact_rollback,
        blks_read,
        blks_hit,
        temp_files,
        temp_bytes,
        deadlocks,
        conflicts,
        stats_reset
      FROM pg_stat_database
      WHERE datname = current_database()
    `;
    const r = rows[0];
    if (!r) {
      return {
        dbName: '', numBackends: 0, xactCommit: 0, xactRollback: 0,
        blksRead: 0, blksHit: 0, cacheHitRatio: 1, tempFiles: 0,
        tempBytes: 0, deadlocks: 0, conflictsTotal: 0, statsResetAt: null,
      };
    }
    const blksRead = Number(r.blks_read);
    const blksHit  = Number(r.blks_hit);
    return {
      dbName:         r.datname,
      numBackends:    r.numbackends,
      xactCommit:     Number(r.xact_commit),
      xactRollback:   Number(r.xact_rollback),
      blksRead,
      blksHit,
      cacheHitRatio:  blksRead + blksHit > 0 ? blksHit / (blksRead + blksHit) : 1,
      tempFiles:      Number(r.temp_files),
      tempBytes:      Number(r.temp_bytes),
      deadlocks:      Number(r.deadlocks),
      conflictsTotal: Number(r.conflicts),
      statsResetAt:   r.stats_reset ? r.stats_reset.toISOString() : null,
    };
  }

  // ── Part 49 (#294) ───────────────────────────────────────────────────────

  /**
   * #294a — Per-table I/O statistics from pg_statio_user_tables.
   * Shows heap, index, and TOAST block reads from disk vs buffer-cache hits
   * for each table.  High disk-read ratios signal cache pressure or cold data.
   */
  async getTableIoStats(limit = 30): Promise<{
    table: string;
    heapBlksRead: number;
    heapBlksHit: number;
    heapCacheHitRatio: number;
    idxBlksRead: number;
    idxBlksHit: number;
    toastBlksRead: number;
    toastBlksHit: number;
  }[]> {
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
   * #294b — Per-index access statistics from pg_stat_user_indexes.
   * Surfaces scan counts, rows read, and rows fetched per index so operators
   * can identify cold (never-scanned) indexes and highly-used ones.
   */
  async getIndexUsageStats(limit = 30): Promise<{
    table: string;
    index: string;
    idxScan: number;
    idxTupRead: number;
    idxTupFetch: number;
  }[]> {
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
    const rows = await query<Array<{
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

  // ── Part 33 (#278) ───────────────────────────────────────────────────────

  /**
   * #278a — Query plan cache: surfaces prepared-statement plan invalidations
   * from the `db_query_plan_cache` table, ordered by most resets first.
   * High plan_resets values indicate plan-cache thrashing.
   */
  async getQueryPlanCache(limit = 20): Promise<{
    queryHash: string;
    queryText: string;
    planCalls: number;
    planResets: number;
    lastPlanReset: string | null;
    recordedAt: string;
  }[]> {
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

  /**
   * #278b — Top tables by total on-disk size with row-count estimates.
   * Combines pg_class size data with pg_stat_user_tables live/dead row counts.
   */
  async getTopTablesBySize(limit = 20): Promise<{
    table: string;
    totalPretty: string;
    totalBytes: number;
    liveRows: number;
    deadRows: number;
    bloatRatio: number;
    lastVacuum: string | null;
  }[]> {
    const rows = await query<Array<{
      relname: string;
      total_pretty: string;
      total_bytes: bigint;
      n_live_tup: bigint;
      n_dead_tup: bigint;
      last_autovacuum: Date | null;
    }>>`
      SELECT
        c.relname,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_pretty,
        pg_total_relation_size(c.oid)                 AS total_bytes,
        COALESCE(s.n_live_tup, 0)                     AS n_live_tup,
        COALESCE(s.n_dead_tup, 0)                     AS n_dead_tup,
        s.last_autovacuum
      FROM pg_class c
      LEFT JOIN pg_stat_user_tables s ON s.relname = c.relname
      WHERE c.relkind = 'r'
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT ${limit}
    `;
    return rows.map(r => {
      const live = Number(r.n_live_tup);
      const dead = Number(r.n_dead_tup);
      return {
        table:       r.relname,
        totalPretty: r.total_pretty,
        totalBytes:  Number(r.total_bytes),
        liveRows:    live,
        deadRows:    dead,
        bloatRatio:  live + dead > 0 ? dead / (live + dead) : 0,
        lastVacuum:  r.last_autovacuum ? r.last_autovacuum.toISOString() : null,
      };
    });
  }

  /**
   * #278c — Deadlock history: recent entries from `db_deadlock_history`,
   * ordered newest first.
   */
  async getDeadlockHistory(limit = 20): Promise<{
    id: number;
    detectedAt: string;
    pid1: number | null;
    pid2: number | null;
    relation: string | null;
    query1: string | null;
    query2: string | null;
    resolved: boolean;
    notes: string | null;
  }[]> {
    const rows = await query<Array<{
      id: bigint;
      detected_at: Date;
      pid1: number | null;
      pid2: number | null;
      relation: string | null;
      query1: string | null;
      query2: string | null;
      resolved: boolean;
      notes: string | null;
    }>>`
      SELECT id, detected_at, pid1, pid2, relation,
             query1, query2, resolved, notes
      FROM db_deadlock_history
      ORDER BY detected_at DESC
      LIMIT ${limit}
    `;
    return rows.map(r => ({
      id:         Number(r.id),
      detectedAt: r.detected_at.toISOString(),
      pid1:       r.pid1,
      pid2:       r.pid2,
      relation:   r.relation,
      query1:     r.query1,
      query2:     r.query2,
      resolved:   r.resolved,
      notes:      r.notes,
    }));
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

  // ── Part 35 (#280) ───────────────────────────────────────────────────────

  /**
   * #280a — Transaction ID wraparound risk.
   * Returns tables whose age (in transactions) is approaching the wraparound
   * limit (2^31 ≈ 2.1 billion).  Tables with age > 1.5 billion need urgent
   * VACUUM FREEZE attention.
   */
  async getXidWraparoundRisk(limit = 20): Promise<{
    table: string;
    schema: string;
    age: number;
    percentToWrap: number;
    frozenXid: string;
    urgency: 'ok' | 'warning' | 'critical';
  }[]> {
    const rows = await query<Array<{
      relname: string;
      nspname: string;
      age: bigint;
      relfrozenxid: string;
    }>>`
      SELECT
        c.relname,
        n.nspname,
        age(c.relfrozenxid)  AS age,
        c.relfrozenxid::text AS relfrozenxid
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY age(c.relfrozenxid) DESC
      LIMIT ${limit}
    `;
    const WRAP_LIMIT = 2_147_483_648; // 2^31
    return rows.map(r => {
      const age = Number(r.age);
      const pct = age / WRAP_LIMIT;
      return {
        table:          r.relname,
        schema:         r.nspname,
        age,
        percentToWrap:  Math.round(pct * 10000) / 100,
        frozenXid:      r.relfrozenxid,
        urgency:        pct >= 0.9 ? 'critical' : pct >= 0.7 ? 'warning' : 'ok',
      };
    });
  }

  /**
   * #280b — Index bloat estimation.
   * Uses pg_stat_user_indexes + pg_class to surface indexes whose size is
   * disproportionately large relative to the number of live tuples in the
   * parent table — a proxy for bloat caused by heavy UPDATE/DELETE workloads.
   */
  async getIndexBloatEstimate(limit = 20): Promise<{
    table: string;
    index: string;
    indexSizeBytes: number;
    indexSizePretty: string;
    idxScans: number;
    liveRows: number;
    bytesPerRow: number;
  }[]> {
    const rows = await query<Array<{
      table_name: string;
      index_name: string;
      index_size: bigint;
      index_size_pretty: string;
      idx_scan: bigint;
      n_live_tup: bigint;
    }>>`
      SELECT
        t.relname                              AS table_name,
        i.relname                              AS index_name,
        pg_relation_size(ix.indexrelid)        AS index_size,
        pg_size_pretty(pg_relation_size(ix.indexrelid)) AS index_size_pretty,
        COALESCE(s.idx_scan, 0)                AS idx_scan,
        COALESCE(st.n_live_tup, 0)             AS n_live_tup
      FROM pg_index ix
      JOIN pg_class t  ON t.oid  = ix.indrelid
      JOIN pg_class i  ON i.oid  = ix.indexrelid
      LEFT JOIN pg_stat_user_indexes s  ON s.indexrelid = ix.indexrelid
      LEFT JOIN pg_stat_user_tables  st ON st.relid      = ix.indrelid
      WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND NOT ix.indisprimary
      ORDER BY pg_relation_size(ix.indexrelid) DESC
      LIMIT ${limit}
    `;
    return rows.map(r => {
      const sizeBytes = Number(r.index_size);
      const liveRows  = Number(r.n_live_tup);
      return {
        table:           r.table_name,
        index:           r.index_name,
        indexSizeBytes:  sizeBytes,
        indexSizePretty: r.index_size_pretty,
        idxScans:        Number(r.idx_scan),
        liveRows,
        bytesPerRow:     liveRows > 0 ? Math.round(sizeBytes / liveRows) : sizeBytes,
      };
    });
  }

  /**
   * #280c — Per-table I/O statistics from pg_statio_user_tables.
   * Returns heap and index block hit/read counts so operators can identify
   * tables with poor buffer-cache utilisation.
   */
  async getTableIoStats(limit = 20): Promise<{
    table: string;
    heapBlksRead: number;
    heapBlksHit: number;
    idxBlksRead: number;
    idxBlksHit: number;
    toastBlksRead: number;
    toastBlksHit: number;
    heapHitRatio: number;
    idxHitRatio: number;
  }[]> {
    const rows = await query<Array<{
      relname: string;
      heap_blks_read: bigint;
      heap_blks_hit: bigint;
      idx_blks_read: bigint;
      idx_blks_hit: bigint;
      toast_blks_read: bigint;
      toast_blks_hit: bigint;
    }>>`
      SELECT
        relname,
        COALESCE(heap_blks_read,  0) AS heap_blks_read,
        COALESCE(heap_blks_hit,   0) AS heap_blks_hit,
        COALESCE(idx_blks_read,   0) AS idx_blks_read,
        COALESCE(idx_blks_hit,    0) AS idx_blks_hit,
        COALESCE(toast_blks_read, 0) AS toast_blks_read,
        COALESCE(toast_blks_hit,  0) AS toast_blks_hit
      FROM pg_statio_user_tables
      ORDER BY (COALESCE(heap_blks_read, 0) + COALESCE(idx_blks_read, 0)) DESC
      LIMIT ${limit}
    `;
    return rows.map(r => {
      const hr = Number(r.heap_blks_read), hh = Number(r.heap_blks_hit);
      const ir = Number(r.idx_blks_read),  ih = Number(r.idx_blks_hit);
      return {
        table:         r.relname,
        heapBlksRead:  hr,
        heapBlksHit:   hh,
        idxBlksRead:   ir,
        idxBlksHit:    ih,
        toastBlksRead: Number(r.toast_blks_read),
        toastBlksHit:  Number(r.toast_blks_hit),
        heapHitRatio:  hr + hh > 0 ? hh / (hr + hh) : 1,
        idxHitRatio:   ir + ih > 0 ? ih / (ir + ih) : 1,
      };
    });
  }

  /**
   * #280d — Autovacuum activity: tables currently being processed by
   * autovacuum or autoanalyze from pg_stat_activity.
   * Returns an empty array when no autovacuum workers are running.
   */
  async getAutovacuumActivity(): Promise<{
    pid: number;
    datname: string;
    relname: string;
    phase: string;
    heapBlksTotal: number;
    heapBlksScanned: number;
    heapBlksVacuumed: number;
    indexVacuumCount: number;
    maxDeadTuples: number;
    numDeadTuples: number;
  }[]> {
    const rows = await query<Array<{
      pid: number;
      datname: string;
      relname: string;
      phase: string;
      heap_blks_total: bigint;
      heap_blks_scanned: bigint;
      heap_blks_vacuumed: bigint;
      index_vacuum_count: bigint;
      max_dead_tuples: bigint;
      num_dead_tuples: bigint;
    }>>`
      SELECT
        p.pid,
        p.datname,
        v.relname,
        v.phase,
        COALESCE(v.heap_blks_total,    0) AS heap_blks_total,
        COALESCE(v.heap_blks_scanned,  0) AS heap_blks_scanned,
        COALESCE(v.heap_blks_vacuumed, 0) AS heap_blks_vacuumed,
        COALESCE(v.index_vacuum_count, 0) AS index_vacuum_count,
        COALESCE(v.max_dead_tuples,    0) AS max_dead_tuples,
        COALESCE(v.num_dead_tuples,    0) AS num_dead_tuples
      FROM pg_stat_progress_vacuum v
      JOIN pg_stat_activity p ON p.pid = v.pid
    `;
    return rows.map(r => ({
      pid:               r.pid,
      datname:           r.datname,
      relname:           r.relname,
      phase:             r.phase,
      heapBlksTotal:     Number(r.heap_blks_total),
      heapBlksScanned:   Number(r.heap_blks_scanned),
      heapBlksVacuumed:  Number(r.heap_blks_vacuumed),
      indexVacuumCount:  Number(r.index_vacuum_count),
      maxDeadTuples:     Number(r.max_dead_tuples),
      numDeadTuples:     Number(r.num_dead_tuples),
    }));
  }

  /**
   * #280e — Slow-query aggregation from db_query_stats.
   * Returns per-endpoint aggregates (count, avg, p95, max) over a rolling
   * window so operators can spot regressions without querying pg_stat_statements.
   */
  async getSlowQueryAggregates(windowMinutes = 60, limit = 20): Promise<{
    endpoint: string;
    callCount: number;
    avgMs: number;
    p95Ms: number;
    maxMs: number;
    cacheHitRate: number;
    windowStart: string;
  }[]> {
    const rows = await query<Array<{
      endpoint: string;
      call_count: bigint;
      avg_ms: number;
      p95_ms: number;
      max_ms: number;
      cache_hits: bigint;
      window_start: Date;
    }>>`
      SELECT
        endpoint,
        count(*)                                                    AS call_count,
        avg(execution_ms)                                           AS avg_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms) AS p95_ms,
        max(execution_ms)                                           AS max_ms,
        count(*) FILTER (WHERE cache_hit = TRUE)                    AS cache_hits,
        min(recorded_at)                                            AS window_start
      FROM db_query_stats
      WHERE recorded_at >= NOW() - (${windowMinutes} * INTERVAL '1 minute')
      GROUP BY endpoint
      ORDER BY avg(execution_ms) DESC
      LIMIT ${limit}
    `;
    return rows.map(r => {
      const calls = Number(r.call_count);
      const hits  = Number(r.cache_hits);
      return {
        endpoint:     r.endpoint,
        callCount:    calls,
        avgMs:        Math.round(r.avg_ms),
        p95Ms:        Math.round(r.p95_ms),
        maxMs:        r.max_ms,
        cacheHitRate: calls > 0 ? hits / calls : 0,
        windowStart:  r.window_start.toISOString(),
      };
    });
  }
}
