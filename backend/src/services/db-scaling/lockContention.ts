/**
 * Lock Contention Monitor
 * Tracks database lock contention including deadlock history and lock waits.
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

export interface LockWait {
  waitingPid: number;
  blockingPid: number;
  lockType: string;
  relation: string | null;
  waitingQuery: string;
  waitDuration: string | null;
}

export interface DeadlockHistoryEntry {
  id: number;
  detectedAt: string;
  pid1: number | null;
  pid2: number | null;
  relation: string | null;
  query1: string | null;
  query2: string | null;
  resolved: boolean;
  notes: string | null;
}

export class LockContentionMonitor {
  /**
   * #284a — Lock contention: active waits from pg_locks joined to pg_stat_activity.
   * Returns rows where one backend is blocking another, showing both PIDs,
   * the lock type, and the waiting query (truncated to 120 chars).
   */
  async getLockContention(): Promise<LockWait[]> {
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
   * #278c — Deadlock history: recent entries from `db_deadlock_history`.
   */
  async getDeadlockHistory(limit = 20): Promise<DeadlockHistoryEntry[]> {
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
}
