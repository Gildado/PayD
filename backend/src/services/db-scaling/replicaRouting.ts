/**
 * Replica Routing & Health Checks
 * Manages health checks and replication lag monitoring for replica failover
 * and load balancing decisions.
 */

import pool from '../../config/database.js';
import logger from '../../utils/logger.js';

function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = '';
  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) text += '$' + (i + 1);
  });
  return pool.query(text, values as unknown[]).then((r) => r.rows as T[]);
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
}

export interface ReplicationStatus {
  clientAddr: string | null;
  state: string;
  sentLsn: string;
  writeLsn: string;
  flushLsn: string;
  replayLsn: string;
  writeLagBytes: number;
  flushLagBytes: number;
  replayLagBytes: number;
}

export class ReplicaRouter {
  /**
   * Run a basic health check against the database connection.
   * Used to determine if a primary or replica is accepting queries.
   */
  async runHealthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await pool.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      logger.error({ err }, 'DB health check failed');
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * #285a — Replication lag: bytes behind primary for each standby replica.
   * Returns an empty array when no replicas are configured (not an error).
   * Used for replica failover and load balancing decisions.
   */
  async getReplicationLag(): Promise<ReplicationStatus[]> {
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

  /**
   * Select the healthiest replica based on replication lag.
   * Returns null if no replicas are healthy or available.
   */
  async selectHealthyReplica(): Promise<ReplicationStatus | null> {
    const replicas = await this.getReplicationLag();
    if (replicas.length === 0) return null;

    // Sort by replay lag (ascending) to find the most caught-up replica
    replicas.sort((a, b) => a.replayLagBytes - b.replayLagBytes);
    return replicas[0] ?? null;
  }

  /**
   * Get overall health status of replicas in the cluster.
   */
  async getHealthStatus(): Promise<{
    primary: HealthCheckResult;
    replicaCount: number;
    totalLagBytes: number;
    maxLagBytes: number;
  }> {
    const primary = await this.runHealthCheck();
    const replicas = await this.getReplicationLag();

    const totalLagBytes = replicas.reduce((sum, r) => sum + r.replayLagBytes, 0);
    const maxLagBytes = replicas.length > 0 
      ? Math.max(...replicas.map(r => r.replayLagBytes))
      : 0;

    return {
      primary,
      replicaCount: replicas.length,
      totalLagBytes,
      maxLagBytes,
    };
  }
}
