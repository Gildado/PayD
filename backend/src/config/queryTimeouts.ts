/**
 * @file src/config/queryTimeouts.ts
 * @description Per-class statement timeouts (#1811).
 *
 * Two query classes share the connection pool but have very different
 * latency budgets:
 *
 *   interactive  Request/response queries behind API calls. Must fail fast so a
 *                user never waits on a stuck query and the connection is freed.
 *   reporting    Long-running analytical or diagnostic queries (reports, EXPLAIN
 *                ANALYZE in the slow-query monitor). Allowed more time, but still
 *                bounded so one report cannot hold a pool connection forever.
 *
 * The pool-wide `statement_timeout` (DB_STATEMENT_TIMEOUT_MS) still applies to any
 * query that does not go through {@link runWithQueryClass}. Classed queries
 * override it for their own transaction only, via `SET LOCAL`, so the setting
 * never leaks to other requests that reuse the same pooled connection.
 *
 * Config (env, all milliseconds):
 *   DB_INTERACTIVE_STATEMENT_TIMEOUT_MS  default 5000    bounds 100..60000
 *   DB_REPORTING_STATEMENT_TIMEOUT_MS    default 120000  bounds 1000..600000
 *   The reporting timeout must be strictly greater than the interactive one.
 */

import type { PoolClient } from 'pg';

export type QueryClass = 'interactive' | 'reporting';

export interface StatementTimeouts {
  interactive: number;
  reporting: number;
}

export const STATEMENT_TIMEOUT_BOUNDS: Record<QueryClass, { min: number; max: number }> = {
  interactive: { min: 100, max: 60_000 },
  reporting: { min: 1_000, max: 600_000 },
};

/** PostgreSQL SQLSTATE for "canceling statement due to statement timeout". */
export const STATEMENT_TIMEOUT_SQLSTATE = '57014';

function parseBoundedMs(name: string, raw: string, bounds: { min: number; max: number }): number {
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer number of milliseconds (got "${raw}").`);
  }
  if (value < bounds.min || value > bounds.max) {
    throw new Error(`${name} must be between ${bounds.min} and ${bounds.max} ms (got ${value}).`);
  }
  return value;
}

/**
 * Parse and validate the two class timeouts. Throws with a message naming the
 * offending variable, so a misconfigured deploy fails at startup.
 */
export function resolveStatementTimeouts(input: {
  DB_INTERACTIVE_STATEMENT_TIMEOUT_MS: string;
  DB_REPORTING_STATEMENT_TIMEOUT_MS: string;
}): StatementTimeouts {
  const interactive = parseBoundedMs(
    'DB_INTERACTIVE_STATEMENT_TIMEOUT_MS',
    input.DB_INTERACTIVE_STATEMENT_TIMEOUT_MS,
    STATEMENT_TIMEOUT_BOUNDS.interactive
  );
  const reporting = parseBoundedMs(
    'DB_REPORTING_STATEMENT_TIMEOUT_MS',
    input.DB_REPORTING_STATEMENT_TIMEOUT_MS,
    STATEMENT_TIMEOUT_BOUNDS.reporting
  );

  if (reporting <= interactive) {
    throw new Error(
      `DB_REPORTING_STATEMENT_TIMEOUT_MS (${reporting}) must be greater than ` +
        `DB_INTERACTIVE_STATEMENT_TIMEOUT_MS (${interactive}).`
    );
  }

  return { interactive, reporting };
}

/** Build the `SET LOCAL` statement. The value is a validated integer, never user input. */
export function statementTimeoutSql(ms: number): string {
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new Error(`Invalid statement timeout: ${ms}`);
  }
  return `SET LOCAL statement_timeout = ${ms}`;
}

/** Minimal pool surface, so tests can pass a fake without importing the real pool. */
export interface ConnectablePool {
  connect(): Promise<PoolClient>;
}

/**
 * Run `fn` on a dedicated pooled connection inside a transaction whose
 * statement_timeout is set for the given query class. The timeout is scoped to
 * the transaction (SET LOCAL), and the connection is released in all cases.
 */
export async function runWithQueryClass<T>(
  pool: ConnectablePool,
  queryClass: QueryClass,
  timeouts: StatementTimeouts,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(statementTimeoutSql(timeouts[queryClass]));
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Convenience wrapper: run one parameterised query under a query class. */
export async function queryWithClass<T = any>(
  pool: ConnectablePool,
  queryClass: QueryClass,
  timeouts: StatementTimeouts,
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  return runWithQueryClass(pool, queryClass, timeouts, (client) =>
    client.query<T>(text, params)
  ) as Promise<{ rows: T[] }>;
}

/** True when a pg error was caused by the statement timeout firing. */
export function isStatementTimeoutError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === STATEMENT_TIMEOUT_SQLSTATE
  );
}
