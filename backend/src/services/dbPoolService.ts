/**
 * @file src/services/dbPoolService.ts
 * @description Connection-pool manager with health monitoring and query-stats
 *              recording.  Part of the API & Database Scaling effort (Issue #272
 *              / Wave #717 – Part 27).
 *
 * Responsibilities
 * ────────────────
 * 1. Expose a singleton Pool that every service module must reuse.
 * 2. Periodically snapshot pool utilisation into `db_pool_health`.
 * 3. Provide a thin `query()` wrapper that measures wall-clock time and
 *    persists slow-query records to `db_query_stats`.
 * 4. Export pool health data for the /api/v1/scaling/health endpoint.
 */

import { Pool, PoolClient, QueryResult } from 'pg';

import logger from '../utils/logger.js';
import { withConnectionRetry } from '../utils/retry.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const SLOW_QUERY_THRESHOLD_MS = 200;
const POOL_HEALTH_INTERVAL_MS = 60_000; // snapshot every minute

// ─── Singleton pool ──────────────────────────────────────────────────────────

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set.');
    }

    _pool = new Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX ?? 20),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5_000),
    });

    _pool.on('error', (err) => {
      logger.error({ err }, '[dbPoolService] Unexpected pool error');
    });

    logger.info('[dbPoolService] PostgreSQL connection pool initialised');
    _startHealthSnapshots();
  }

  return _pool;
}

// ─── Instrumented query wrapper ───────────────────────────────────────────────

export interface QueryStats {
  endpoint: string;
  queryHash: string;
  executionMs: number;
  rowsReturned: number;
  cacheHit: boolean;
}

/**
 * Execute a parameterised query and record its stats.
 *
 * @param text      SQL query string
 * @param params    Bound parameter values
 * @param endpoint  Logical name of the caller (e.g. "GET /employees")
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  endpoint = 'unknown',
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  const result = await withConnectionRetry(
    () => pool.query<T>(text, params),
    { maxRetries: 2, baseDelayMs: 500 }
  );

  const executionMs = Date.now() - start;
  const rowsReturned = result.rowCount ?? 0;

  // Only persist slow queries (or record everything when DEBUG_QUERY_STATS=true)
  if (executionMs >= SLOW_QUERY_THRESHOLD_MS || process.env.DEBUG_QUERY_STATS === 'true') {
    _recordQueryStats({
      endpoint,
      queryHash: _hashQuery(text),
      executionMs,
      rowsReturned,
      cacheHit: false,
    }).catch((err) =>
      logger.warn({ err }, '[dbPoolService] Failed to persist query stats'),
    );
  }

  return result;
}

// ─── Pool health snapshot ────────────────────────────────────────────────────

export interface PoolHealthSnapshot {
  totalConns: number;
  idleConns: number;
  waitingClients: number;
  recordedAt: Date;
}

export function getPoolStats(): PoolHealthSnapshot {
  const pool = getPool();
  return {
    totalConns: pool.totalCount,
    idleConns: pool.idleCount,
    waitingClients: pool.waitingCount,
    recordedAt: new Date(),
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _startHealthSnapshots(): void {
  setInterval(async () => {
    const stats = getPoolStats();
    try {
      await getPool().query(
        `INSERT INTO db_pool_health (total_conns, idle_conns, waiting_clients)
         VALUES ($1, $2, $3)`,
        [stats.totalConns, stats.idleConns, stats.waitingClients],
      );
    } catch (err) {
      logger.warn({ err }, '[dbPoolService] Failed to record pool health snapshot');
    }
  }, POOL_HEALTH_INTERVAL_MS);
}

async function _recordQueryStats(stats: QueryStats): Promise<void> {
  await getPool().query(
    `INSERT INTO db_query_stats
       (endpoint, query_hash, execution_ms, rows_returned, cache_hit)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      stats.endpoint,
      stats.queryHash,
      stats.executionMs,
      stats.rowsReturned,
      stats.cacheHit,
    ],
  );
}

/**
 * Stable, deterministic hash of a normalised SQL string.
 * Strips leading/trailing whitespace and collapses inner runs of whitespace
 * so that formatting changes don't produce different hashes.
 */
function _hashQuery(sql: string): string {
  const normalised = sql.replace(/\s+/g, ' ').trim();
  let hash = 0;
  for (let i = 0; i < normalised.length; i++) {
    hash = (Math.imul(31, hash) + normalised.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    logger.info('[dbPoolService] Pool closed');
  }
}
