/**
 * @file src/db/migrate.ts
 * @description CLI entry point for PostgreSQL migration runner.
 *
 * Thin CLI wrapper that delegates to MigrationRunner and supporting modules.
 * Handles argument parsing, logging, and exit codes.
 *
 * Usage
 * ─────
 *   ts-node src/db/migrate.ts                  # run pending migrations
 *   ts-node src/db/migrate.ts --dry-run         # generate the plan only
 *   ts-node src/db/migrate.ts --skip-backup     # skip pre-migration backup
 *   ts-node src/db/migrate.ts --rollback        # roll back the most recently applied migration
 *   ts-node src/db/migrate.ts --rollback 3      # roll back the last 3 migrations
 *   ts-node src/db/migrate.ts --rollback --dry-run
 */

import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import { fileURLToPath } from 'url';

import { MigrationRunner } from './migrationRunner.js';
import { MigrationLogger } from './migrationLogger.js';

import {
  buildMigrationFailureAlert,
  createMigrationAlertSink,
  type MigrationAlertSink,
} from '../services/migrationAlertService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Bootstrap ──────────────────────────────────────────────────────────────

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');
const ROLLBACKS_DIR = path.resolve(__dirname, 'rollbacks');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Mask a database URL for safe logging.
 */
function maskConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.password = u.password ? '***' : '';
    return u.toString();
  } catch {
    return url.replace(/:\w+@/, ':***@');
  }
}

/**
 * Run migrations in forward mode.
 */
async function runMigrations(skipBackup: boolean): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
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

// ─── Failure alerting + auto-rollback ────────────────────────────────────────

export async function alertMigrationFailure(
  filename: string,
  error: unknown,
  rollbackSucceeded = false,
  sink: MigrationAlertSink = createMigrationAlertSink()
): Promise<void> {
  const alert = buildMigrationFailureAlert(filename, error, rollbackSucceeded);
  console.error('[migrate] ────────────────────────────────────────────────────');
  console.error(
    `[migrate] ALERT alert=${alert.alert} migrationId="${alert.migrationId}" filename="${alert.filename}"`
  );
  console.error(`[migrate] ${alert.error}`);
  console.error('[migrate] ────────────────────────────────────────────────────');

  try {
    await sink(alert);
  } catch (alertError) {
    console.error('[migrate] Failed to deliver migration failure alert:', alertError);
  }
}

/**
 * Attempt to automatically execute the rollback script matching a failed
 * migration. Because each migration runs inside its own transaction, a SQL
 * error already leaves the database in its pre-migration state — this is a
 * defense-in-depth safety net for non-transactional failure modes (e.g. a
 * post-migration verification failure after DDL that implicitly committed,
 * or partial application via `CREATE INDEX CONCURRENTLY`). All rollback SQL
 * in this repo uses `IF EXISTS` guards, so re-running it is always safe.
 */
export async function attemptAutoRollback(client: PoolClient, filename: string): Promise<boolean> {
  const rollbackFile = path.join(ROLLBACKS_DIR, filename);

  if (!fs.existsSync(rollbackFile)) {
    console.error(`[migrate] No rollback file found for "${filename}"; cannot auto-rollback.`);
    return false;
  }

  try {
    const runner = new MigrationRunner(pool, MIGRATIONS_DIR, ROLLBACKS_DIR, skipBackup);
    const result = await runner.runMigrations();

    const totalMs = result.applied.length > 0 ? Date.now() : 0;
    console.log('');
    console.log('─────────────────────────────────────────');
    console.log(`[migrate] Summary`);
    console.log(`  Applied : ${result.applied.length}`);
    console.log(`  Skipped : ${result.skipped.length}`);
    console.log(`  Failed  : ${result.failures.length}`);
    console.log(`  Drift   : ${result.driftDetected.length}`);
    console.log('─────────────────────────────────────────');

    if (result.failures.length > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

/**
 * Run migrations in dry-run mode.
 */
export function renderDryRunPlan(pending: MigrationFile[]): string {
  const header =
    `-- Dry-run migration plan generated ${new Date().toISOString()}\n` +
    `-- ${pending.length} pending migration(s) would run, in this exact order.\n` +
    `-- Nothing has been executed. Review before applying with: npm run db:migrate\n\n`;

  const body = pending
    .map((f) => `-- ===== ${f.filename}  (checksum ${f.checksum}) =====\n${f.sql}\n`)
    .join('\n');

  return header + body;
}

/** Write a rendered dry-run plan to `<backupDir>/dry-run-plans/`. */
function writeDryRunPlan(planText: string): string {
  const dir = path.join(resolveBackupDir(), 'dry-run-plans');
  fs.mkdirSync(dir, { recursive: true });
  const planPath = path.join(dir, `dry-run-plan-${Date.now()}.sql`);
  fs.writeFileSync(planPath, planText, 'utf8');
  return planPath;
}

// ─── Core runner ─────────────────────────────────────────────────────────────

/**
 * Generate (and persist to disk) the exact SQL that would run for all
 * currently-pending migrations, without connecting for writes or executing
 * anything. If `DATABASE_URL` is set, performs one read-only query to
 * determine which migrations are already applied so the plan is accurate;
 * otherwise every migration file is treated as pending.
 */
async function runDryRun(): Promise<RunResult> {
  const files = readMigrationFiles(MIGRATIONS_DIR);
  assertNoDuplicatePrefixes(files);

  let applied = new Map<string, AppliedMigration>();

  if (DATABASE_URL) {
    const pool = new Pool({ connectionString: DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ reg: string | null }>(
        `SELECT to_regclass('public.schema_migrations')::text AS reg`
      );
      if (rows[0]?.reg) {
        applied = await fetchAppliedMigrations(client);
      } else {
        console.log(
          '[migrate] [dry-run] schema_migrations table does not exist yet — treating all files as pending.'
        );
      }
    } finally {
      client.release();
      await pool.end();
    }
  } else {
    console.log(
      '[migrate] [dry-run] DATABASE_URL not set — cannot verify already-applied migrations; showing the full plan for all files.'
    );
  }

  const pending = files.filter((f) => !applied.has(f.filename));
  const planText = renderDryRunPlan(pending);
  const planPath = writeDryRunPlan(planText);

  console.log(`[migrate] [dry-run] ${pending.length} pending migration(s); full SQL plan written to:`);
  console.log(`[migrate]   ${planPath}`);
  for (const f of pending) {
    console.log(`[migrate] [dry-run] Would apply: ${f.filename}  (checksum: ${f.checksum})`);
  }

  return {
    applied: pending.map((f) => f.filename),
    skipped: [...applied.keys()],
    driftDetected: [],
    failures: [],
    sqlPlanPath: planPath,
  };
}

async function runMigrations(
  skipBackup: boolean,
  alertSink: MigrationAlertSink = createMigrationAlertSink()
): Promise<RunResult> {
  const pool = new Pool({
    connectionString: DATABASE_URL ?? undefined,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const runner = new MigrationRunner(pool, MIGRATIONS_DIR, ROLLBACKS_DIR, true);
    const result = await runner.runDryRun();

    // ── Step 2: Read migration files ──────────────────────────────────────
    const files = readMigrationFiles(MIGRATIONS_DIR);
    console.log(`[migrate] Found ${files.length} migration file(s) in ${MIGRATIONS_DIR}`);

    // ── Step 2a: Guard against duplicate numeric prefixes ────────────────
    assertNoDuplicatePrefixes(files);

    if (files.length === 0) {
      console.log('[migrate] Nothing to do.');
      return result;
    }

    // ── Step 3: Fetch already-applied set (O(m) time / space) ─────────────
    const applied = await fetchAppliedMigrations(client);
    const pendingFiles = files.filter((f) => !applied.has(f.filename));

    // ── Step 3a: Pre-migration backup (pg_dump), on by default (#1039) ────
    if (pendingFiles.length > 0) {
      if (skipBackup) {
        console.log('[migrate] ⚠ Backup skipped (--skip-backup / MIGRATION_SKIP_BACKUP). Not recommended in production.');
      } else {
        console.log('[migrate] Taking pre-migration pg_dump backup...');
        const backup = await takePreMigrationBackup(DATABASE_URL!);
        result.backup = backup;
        if (!backup.taken) {
          throw new Error(
            `Pre-migration backup failed: ${backup.error}. Aborting migration run. ` +
              'Pass --skip-backup (not recommended in production) to override.'
          );
        }
        console.log(`[migrate] ✓ Pre-migration backup captured: ${backup.path}`);
      }
    }

    // ── Step 4: Evaluate each migration ───────────────────────────────────
    for (const file of files) {
      const record = applied.get(file.filename);

      if (record !== undefined) {
        // File already applied — check for content drift (tampering detection).
        if (record.checksum !== file.checksum) {
          const msg =
            `[migrate] DRIFT DETECTED: "${file.filename}" at "${file.absolutePath}" was previously ` +
            `applied with checksum ${record.checksum} but the file now has ` +
            `checksum ${file.checksum}. ` +
            `Aborting to protect database integrity.`;
          console.error(msg);
          result.driftDetected.push(file.filename);
          continue;
        }

        console.log(`[migrate] ↷ Skipped  ${file.filename}  (already applied)`);
        result.skipped.push(file.filename);
        continue;
      }

      // ── Step 5: Apply pending migration in an atomic transaction ─────────
      const startedAt = new Date();
      const startMs = Date.now();
      await client.query('BEGIN');

      let verification: VerificationResult | null = null;

      try {
        await client.query(file.sql);

        // ── Step 5a: Post-migration verification (#1039) ───────────────────
        verification = await verifySchemaIntegrity(client);
        if (!verification.passed) {
          throw new Error(
            `Post-migration verification failed for "${file.filename}": ${verification.issues.join('; ')}`
          );
        }

        const executionMs = Date.now() - startMs;

        // Record INSIDE the same transaction so a runner crash after SQL
        // execution but before the INSERT cannot leave an unrecorded migration.
        await recordMigration(client, file.filename, file.checksum, executionMs);

        await client.query('COMMIT');

        await recordRunLog(client, {
          filename: file.filename,
          status: 'success',
          startedAt,
          executionMs,
          backupTaken: result.backup?.taken ?? false,
          backupPath: result.backup?.path,
          verificationPassed: true,
          verificationIssues: [],
        });

        console.log(`[migrate] ✓ Applied   ${file.filename}  (${executionMs} ms)`);
        result.applied.push(file.filename);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const executionMs = Date.now() - startMs;

        console.error(`[migrate] ✗ Failed   ${file.filename}`);

        const rollbackSucceeded = await attemptAutoRollback(client, file.filename);
        await alertMigrationFailure(file.filename, err, rollbackSucceeded, alertSink);

        await recordRunLog(client, {
          filename: file.filename,
          status: 'failure',
          startedAt,
          executionMs,
          backupTaken: result.backup?.taken ?? false,
          backupPath: result.backup?.path,
          verificationPassed: verification ? verification.passed : false,
          verificationIssues: verification?.issues ?? [],
          errorMessage: err instanceof Error ? err.message : String(err),
          rollbackAttempted: true,
          rollbackSucceeded,
        }).catch((logErr) => {
          console.error('[migrate] Failed to record failure in migration_run_log:', logErr);
        });

        result.failures.push(file.filename);
        throw err; // Surface to outer try/catch; unconditionally exit(1).
      }
    }
    for (const f of result.applied) {
      console.log(`[migrate] [dry-run] Would apply: ${f}`);
    }
  } finally {
    if (DATABASE_URL) {
      await pool.end();
    }
  }
}

/**
 * Run rollback mode.
 */
async function runRollback(
  steps: number,
  isDryRun: boolean,
  alertSink: MigrationAlertSink = createMigrationAlertSink()
): Promise<void> {
  if (!fs.existsSync(ROLLBACKS_DIR)) {
    throw new Error(
      `Rollbacks directory not found: ${ROLLBACKS_DIR}. ` +
        'Create rollback SQL files in src/db/rollbacks/ with names matching the migration files.'
    );
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();

  try {
    // Fetch applied migrations in reverse order
    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY id DESC LIMIT $1',
      [steps]
    );

    if (rows.length === 0) {
      console.log('[migrate] No applied migrations found to roll back.');
      return;
    }

    console.log(`[migrate] Rolling back ${rows.length} migration(s):`);

    for (const { filename } of rows) {
      const rollbackFile = path.join(ROLLBACKS_DIR, filename);

      if (!fs.existsSync(rollbackFile)) {
        throw new Error(
          `Missing rollback file for "${filename}". ` +
            `Expected: ${rollbackFile}. ` +
            'Every migration must have a corresponding rollback SQL file.'
        );
      }

      const sql = fs.readFileSync(rollbackFile, 'utf8');

      if (isDryRun) {
        console.log(`[migrate] [dry-run] Would roll back: ${filename}`);
        continue;
      }

      const startMs = Date.now();
      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query('DELETE FROM schema_migrations WHERE filename = $1', [filename]);
        await client.query('COMMIT');
        const executionMs = Date.now() - startMs;
        console.log(`[migrate] ↩ Rolled back  ${filename}  (${executionMs} ms)`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`[migrate] ✗ Rollback failed for  ${filename}`);
        await alertMigrationFailure(filename, err, false, alertSink);
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  const skipBackup = process.argv.includes('--skip-backup') || process.env.MIGRATION_SKIP_BACKUP === 'true';
  const rollbackIdx = process.argv.indexOf('--rollback');
  const isRollback = rollbackIdx !== -1;

  console.log(`[migrate] Starting migration runner${isDryRun ? ' (DRY RUN)' : ''}`);

  const requiresDatabaseUrl = isRollback || !isDryRun;
  if (requiresDatabaseUrl && !DATABASE_URL) {
    console.error('[migrate] ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log(
    DATABASE_URL
      ? `[migrate] Target database: ${maskConnectionString(DATABASE_URL)}`
      : '[migrate] Target database: N/A (dry-run, no DB connection required)'
  );

  const startMs = Date.now();

  try {
    if (isRollback) {
      const nextArg = process.argv[rollbackIdx + 1];
      const steps = nextArg && /^\d+$/.test(nextArg) ? parseInt(nextArg, 10) : 1;
      console.log(`[migrate] Mode: ROLLBACK (${steps} step${steps === 1 ? '' : 's'})`);
      await runRollback(steps, isDryRun);
    } else if (isDryRun) {
      await runDryRun();
    } else {
      await runMigrations(skipBackup);
    }

    const totalMs = Date.now() - startMs;
    console.log(`[migrate] Done.  (${totalMs} ms)`);
  } catch (err) {
    console.error(`[migrate] FAILED:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[migrate] Unexpected error:', err);
  process.exit(1);
});
