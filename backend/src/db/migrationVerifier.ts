/**
 * Migration Verifier
 * Post-migration schema integrity checks.
 */

import { PoolClient } from 'pg';

export interface VerificationResult {
  passed: boolean;
  issues: string[];
}

export class MigrationVerifier {
  /**
   * Post-migration schema-integrity verification.
   * Checks for invalid indexes and unvalidated constraints.
   * Executed inside the migration's transaction so failures trigger rollback.
   */
  static async verifySchemaIntegrity(client: PoolClient): Promise<VerificationResult> {
    const issues: string[] = [];

    const invalidIndexes = await client.query<{ name: string }>(
      `SELECT indexrelid::regclass::text AS name FROM pg_index WHERE NOT indisvalid`
    );
    for (const row of invalidIndexes.rows) {
      issues.push(`Invalid (not-ready) index left behind: ${row.name}`);
    }

    const invalidConstraints = await client.query<{ conname: string; table_name: string }>(
      `SELECT conname, conrelid::regclass::text AS table_name
       FROM pg_constraint
       WHERE NOT convalidated`
    );
    for (const row of invalidConstraints.rows) {
      issues.push(`Unvalidated constraint left behind: "${row.conname}" on ${row.table_name}`);
    }

    return { passed: issues.length === 0, issues };
  }

  /**
   * Attempt to automatically execute the rollback script matching a failed migration.
   */
  static async attemptAutoRollback(client: PoolClient, filename: string, rollbackDir: string): Promise<boolean> {
    const path = await import('path');
    const fs = await import('fs');
    
    const rollbackFile = path.join(rollbackDir, filename);

    if (!fs.existsSync(rollbackFile)) {
      console.error(`[migrate] No rollback file found for "${filename}"; cannot auto-rollback.`);
      return false;
    }

    try {
      const sql = fs.readFileSync(rollbackFile, 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`[migrate] ↩ Auto-rollback succeeded for "${filename}".`);
      return true;
    } catch (rollbackErr) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(
        `[migrate] ✗ Auto-rollback FAILED for "${filename}":`,
        rollbackErr instanceof Error ? rollbackErr.message : rollbackErr
      );
      return false;
    }
  }
}
