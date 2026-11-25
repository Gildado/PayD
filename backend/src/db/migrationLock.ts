/**
 * Migration Lock Manager
 * Handles advisory locking to prevent concurrent migration execution.
 */

import { PoolClient } from 'pg';

export const MIGRATION_LOCK_KEY = 827_100_239;
export const LOCK_TIMEOUT_MS = 30_000;
const LOCK_POLL_INTERVAL_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MigrationLock {
  /**
   * Ensure the migration tracking schema exists.
   */
  static async ensureSchemaExists(client: PoolClient): Promise<void> {
    const bootstrapSql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id             SERIAL       PRIMARY KEY,
        filename       VARCHAR(255) NOT NULL UNIQUE,
        checksum       CHAR(64)     NOT NULL,
        applied_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        applied_by     VARCHAR(255) NOT NULL DEFAULT current_user,
        execution_ms   INTEGER      CHECK (execution_ms >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename
        ON schema_migrations (filename);

      CREATE TABLE IF NOT EXISTS migration_run_log (
        id                  BIGSERIAL    PRIMARY KEY,
        filename            VARCHAR(255) NOT NULL,
        run_status          VARCHAR(20)  NOT NULL
                             CHECK (run_status IN ('success', 'failure', 'dry_run')),
        started_at          TIMESTAMPTZ  NOT NULL,
        finished_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        execution_ms        INTEGER      CHECK (execution_ms >= 0),
        backup_taken        BOOLEAN      NOT NULL DEFAULT FALSE,
        backup_path         TEXT,
        verification_passed BOOLEAN,
        verification_issues JSONB,
        error_message       TEXT,
        rollback_attempted  BOOLEAN      NOT NULL DEFAULT FALSE,
        rollback_succeeded  BOOLEAN
      );
      CREATE INDEX IF NOT EXISTS idx_migration_run_log_filename
        ON migration_run_log (filename);
      CREATE INDEX IF NOT EXISTS idx_migration_run_log_status_time
        ON migration_run_log (run_status, finished_at DESC);
    `;

    await client.query(bootstrapSql);
  }

  /**
   * Acquire an advisory lock with timeout.
   * Polls pg_try_advisory_lock and gives up after LOCK_TIMEOUT_MS.
   */
  static async acquire(client: PoolClient, timeoutMs: number = LOCK_TIMEOUT_MS): Promise<void> {
    await client.query(`SET lock_timeout = '${timeoutMs}ms'`);

    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { rows } = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [MIGRATION_LOCK_KEY]
      );
      if (rows[0]?.locked) return;

      if (Date.now() >= deadline) {
        throw new Error(
          `Could not acquire the migration advisory lock within ${timeoutMs}ms — ` +
            'another migration run may already be in progress against this database.'
        );
      }
      await sleep(LOCK_POLL_INTERVAL_MS);
    }
  }

  /**
   * Release the advisory lock.
   */
  static async release(client: PoolClient): Promise<void> {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
  }
}
