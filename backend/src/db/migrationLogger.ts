/**
 * Migration Logger
 * Records migration execution history and status.
 */

import { PoolClient } from 'pg';

export interface AppliedMigration {
  filename: string;
  checksum: string;
}

export interface RunLogEntry {
  filename: string;
  status: 'success' | 'failure' | 'dry_run';
  startedAt: Date;
  executionMs: number;
  backupTaken: boolean;
  backupPath?: string;
  verificationPassed?: boolean;
  verificationIssues?: string[];
  errorMessage?: string;
  rollbackAttempted?: boolean;
  rollbackSucceeded?: boolean;
}

export class MigrationLogger {
  /**
   * Fetch the set of already-applied migrations from the tracking table.
   * Returns a Map<filename, AppliedMigration> for O(1) lookup per file.
   */
  static async getAppliedMigrations(client: PoolClient): Promise<Map<string, AppliedMigration>> {
    const { rows } = await client.query<AppliedMigration>(
      'SELECT filename, checksum FROM schema_migrations ORDER BY id'
    );
    const map = new Map<string, AppliedMigration>();
    for (const row of rows) {
      map.set(row.filename, row);
    }
    return map;
  }

  /**
   * Record a successfully-applied migration in the tracking table.
   * Executed inside the same transaction as the migration SQL itself.
   */
  static async recordMigration(
    client: PoolClient,
    filename: string,
    checksum: string,
    executionMs: number
  ): Promise<void> {
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum, execution_ms)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename) DO NOTHING`,
      [filename, checksum, executionMs]
    );
  }

  /**
   * Append a row to `migration_run_log` describing one execution attempt.
   */
  static async recordRunLog(
    client: PoolClient,
    entry: RunLogEntry
  ): Promise<void> {
    await client.query(
      `INSERT INTO migration_run_log
         (filename, run_status, started_at, execution_ms, backup_taken, backup_path,
          verification_passed, verification_issues, error_message,
          rollback_attempted, rollback_succeeded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.filename,
        entry.status,
        entry.startedAt,
        entry.executionMs,
        entry.backupTaken,
        entry.backupPath ?? null,
        entry.verificationPassed ?? null,
        entry.verificationIssues ? JSON.stringify(entry.verificationIssues) : null,
        entry.errorMessage ?? null,
        entry.rollbackAttempted ?? false,
        entry.rollbackSucceeded ?? null,
      ]
    );
  }
}
