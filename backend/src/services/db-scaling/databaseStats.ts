/**
 * Database Statistics Collector
 * Aggregates database-level metrics including transaction throughput,
 * cache hit ratios, I/O timing, and checkpoint activity.
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

export interface DatabaseStats {
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
}

export interface BlockIoStats {
  database: string;
  blkReadTimeMs: number;
  blkWriteTimeMs: number;
  sessionTimeMs: number;
  activeTimeMs: number;
  idleInTransactionTimeMs: number;
}

export interface BgwriterStats {
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
}

export interface TempFileUsage {
  database: string;
  tempFiles: number;
  tempBytes: number;
  tempBytesPretty: string;
}

export interface WalStats {
  walRecords: number;
  walFpi: number;
  walBytes: number;
  walBuffersFull: number;
  walWrite: number;
  walSync: number;
  walWriteTimeMs: number;
  walSyncTimeMs: number;
}

export class DatabaseStatsCollector {
  /**
   * #295a — Database-wide transaction and conflict statistics.
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
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
   */
  async getBlockIoStats(): Promise<BlockIoStats> {
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

  /**
   * #287a — Background writer and checkpoint statistics from pg_stat_bgwriter.
   */
  async getBgwriterStats(): Promise<BgwriterStats> {
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
   */
  async getTempFileUsage(): Promise<TempFileUsage> {
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

  /**
   * #283b — WAL generation statistics from pg_stat_wal.
   */
  async getWalStats(): Promise<WalStats> {
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
}
