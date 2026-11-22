/**
 * Migration Runner
 * Executes migrations with safety checks, logging, and rollback support.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';

import { MigrationLock } from './migrationLock.js';
import { MigrationLogger, AppliedMigration } from './migrationLogger.js';
import { MigrationBackup, BackupResult } from './migrationBackup.js';
import { MigrationVerifier, VerificationResult } from './migrationVerifier.js';

export interface MigrationFile {
  filename: string;
  absolutePath: string;
  sql: string;
  checksum: string;
}

export interface RunResult {
  applied: string[];
  skipped: string[];
  driftDetected: string[];
  failures: string[];
  backup?: BackupResult;
  sqlPlanPath?: string;
}

/** Compute the SHA-256 hex digest of a string. */
export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Guard: scan migration filenames for duplicate numeric prefixes.
 * @throws {Error} if duplicates are found.
 */
export function assertNoDuplicatePrefixes(files: MigrationFile[]): void {
  const prefixMap = new Map<string, string[]>();

  for (const { filename } of files) {
    const match = filename.match(/^(\d+)_/);
    if (!match) continue;
    const prefix = match[1] as string;
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix)!.push(filename);
  }

  const duplicates = [...prefixMap.entries()].filter(([, names]) => names.length > 1);

  if (duplicates.length === 0) return;

  const lines: string[] = [
    'FATAL: Duplicate migration prefix(es) detected.',
    '',
    'Two or more migration files share the same numeric prefix. This corrupts',
    'the sort-order contract and will cause non-deterministic checksum mismatches.',
    '',
  ];

  for (const [prefix, names] of duplicates) {
    lines.push(`  Prefix "${prefix}_" shared by:`);
    for (const name of names) lines.push(`    - ${name}`);
  }

  lines.push('');
  lines.push('Fix: run the re-sequencing script from the repo root:');
  lines.push('  node scripts/resequence-migrations.mjs --dry-run');
  lines.push('  node scripts/resequence-migrations.mjs');

  throw new Error(lines.join('\n'));
}

/**
 * Read all *.sql files from a directory, sorted lexicographically.
 */
export function readMigrationFiles(dir: string): MigrationFile[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((filename) => {
    const absolutePath = path.join(dir, filename);
    const sql = fs.readFileSync(absolutePath, 'utf8');
    const checksum = sha256(sql);
    return { filename, absolutePath, sql, checksum };
  });
}

export class MigrationRunner {
  constructor(
    private pool: Pool,
    private migrationsDir: string,
    private rollbacksDir: string,
    private skipBackup: boolean = false
  ) {}

  /**
   * Run all pending migrations.
   */
  async runMigrations(): Promise<RunResult> {
    const result: RunResult = {
      applied: [],
      skipped: [],
      driftDetected: [],
      failures: [],
    };

    const client = await this.pool.connect();
    try {
      // Bootstrap schema
      await MigrationLock.ensureSchemaExists(client);

      // Acquire lock
      await MigrationLock.acquire(client);

      // Take backup if not skipped
      if (!this.skipBackup) {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
          throw new Error('DATABASE_URL not set');
        }
        result.backup = await MigrationBackup.take(dbUrl);
      }

      // Read migration files
      const files = readMigrationFiles(this.migrationsDir);
      assertNoDuplicatePrefixes(files);

      // Get applied migrations
      const applied = await MigrationLogger.getAppliedMigrations(client);

      // Execute pending migrations
      for (const file of files) {
        const startedAt = new Date();
        const start = Date.now();

        try {
          const existing = applied.get(file.filename);

          if (existing) {
            if (existing.checksum !== file.checksum) {
              result.driftDetected.push(file.filename);
              throw new Error(
                `Checksum mismatch for "${file.filename}": ` +
                `applied has ${existing.checksum}, file has ${file.checksum}`
              );
            }
            result.skipped.push(file.filename);
            continue;
          }

          // Execute within a transaction
          await client.query('BEGIN');
          await client.query(file.sql);

          // Verify schema integrity
          const verification = await MigrationVerifier.verifySchemaIntegrity(client);
          if (!verification.passed) {
            throw new Error(`Schema verification failed: ${verification.issues.join('; ')}`);
          }

          // Record the migration
          const executionMs = Date.now() - start;
          await MigrationLogger.recordMigration(client, file.filename, file.checksum, executionMs);
          await client.query('COMMIT');

          // Log success
          await MigrationLogger.recordRunLog(client, {
            filename: file.filename,
            status: 'success',
            startedAt,
            executionMs,
            backupTaken: !this.skipBackup && !!result.backup?.taken,
            backupPath: result.backup?.path,
            verificationPassed: verification.passed,
            verificationIssues: verification.issues,
          });

          result.applied.push(file.filename);
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          result.failures.push(file.filename);

          const executionMs = Date.now() - start;
          const errorMessage = err instanceof Error ? err.message : String(err);

          this.alertMigrationFailure(file.filename, err);

          // Attempt auto-rollback
          const rollbackSucceeded = await MigrationVerifier.attemptAutoRollback(
            client,
            file.filename,
            this.rollbacksDir
          );

          // Log failure
          await MigrationLogger.recordRunLog(client, {
            filename: file.filename,
            status: 'failure',
            startedAt,
            executionMs,
            backupTaken: !this.skipBackup && !!result.backup?.taken,
            backupPath: result.backup?.path,
            verificationPassed: false,
            errorMessage,
            rollbackAttempted: true,
            rollbackSucceeded,
          });

          // Re-throw to exit
          throw err;
        }
      }

      await MigrationLock.release(client);
    } finally {
      client.release();
    }

    return result;
  }

  /**
   * Generate a dry-run plan without executing.
   */
  async runDryRun(): Promise<RunResult> {
    const result: RunResult = {
      applied: [],
      skipped: [],
      driftDetected: [],
      failures: [],
    };

    const client = await this.pool.connect();
    try {
      await MigrationLock.ensureSchemaExists(client);
      const applied = await MigrationLogger.getAppliedMigrations(client);

      const files = readMigrationFiles(this.migrationsDir);
      assertNoDuplicatePrefixes(files);

      let planText = 'Migration Dry-Run Plan\n=====================\n\n';

      for (const file of files) {
        const existing = applied.get(file.filename);

        if (existing) {
          if (existing.checksum !== file.checksum) {
            result.driftDetected.push(file.filename);
            planText += `❌ DRIFT: ${file.filename}\n`;
            planText += `   Applied: ${existing.checksum.substring(0, 8)}...\n`;
            planText += `   Current: ${file.checksum.substring(0, 8)}...\n\n`;
          } else {
            result.skipped.push(file.filename);
            planText += `✓ SKIP: ${file.filename}\n\n`;
          }
        } else {
          result.applied.push(file.filename);
          planText += `→ APPLY: ${file.filename}\n`;
          planText += `  Lines: ${file.sql.split('\n').length}\n\n`;
        }
      }

      result.sqlPlanPath = this.writeDryRunPlan(planText);
    } finally {
      client.release();
    }

    return result;
  }

  /**
   * Write the dry-run plan to a file.
   */
  private writeDryRunPlan(planText: string): string {
    const dir = path.resolve(
      path.dirname(this.migrationsDir),
      '../backups/dry-run-plans'
    );
    fs.mkdirSync(dir, { recursive: true });

    const filename = `dry-run-plan-${Date.now()}.sql`;
    const outputPath = path.join(dir, filename);
    fs.writeFileSync(outputPath, planText, 'utf8');

    return outputPath;
  }

  /**
   * Alert on migration failure.
   */
  private alertMigrationFailure(filename: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[migrate] ────────────────────────────────────────────────────');
    console.error(`[migrate] ALERT alert=MIGRATION_FAILED filename="${filename}"`);
    console.error(`[migrate] ${message}`);
    console.error(
      '[migrate] TODO: wire this into the ops alerting channel (Slack/PagerDuty/email) — ' +
        'see backupVerificationWorker.ts#sendVerificationNotification for the existing stub pattern.'
    );
    console.error('[migrate] ────────────────────────────────────────────────────');
  }
}
