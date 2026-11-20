/**
 * @file src/db/migrate.ts
 * @description Production-grade PostgreSQL migration runner with safety checks.
 *
 * Responsibilities
 * ────────────────
 * 1. Connect to PostgreSQL using the DATABASE_URL environment variable.
 * 2. Bootstrap the `schema_migrations` and `migration_run_log` tracking tables
 *    when absent (this handles the very first run against a blank database).
 * 3. Read all *.sql files from the migrations directory, sorted lexicographically
 *    so that numeric prefixes (001_, 002_, …) define strict execution order.
 * 4. Acquire a Postgres advisory lock (30s timeout) so two runners never apply
 *    migrations concurrently against the same database (#1039).
 * 5. Take a `pg_dump` backup before applying any pending migration, unless
 *    explicitly skipped via `--skip-backup` / `MIGRATION_SKIP_BACKUP=true` (#1039).
 * 6. For each pending file:
 *    a. Skip if already recorded in `schema_migrations`.
 *    b. Guard against file-content drift on already-applied migrations
 *       (SHA-256 checksum comparison).
 *    c. Execute within a single transaction so a partial failure leaves the
 *       database unchanged and the migration can be retried safely.
 *    d. Run a post-migration schema-integrity verification query (#1039).
 *    e. Record the migration in `schema_migrations` (filename, checksum, ms)
 *       and log the attempt (success/failure) in `migration_run_log`.
 *    f. On failure: alert (structured log), attempt to auto-run the matching
 *       rollback script, and re-throw so the process exits non-zero (#1039).
 * 7. Support a `--dry-run` flag that generates the SQL that WOULD run —
 *    written to a plan file — without executing or writing anything (#1039).
 * 8. Exit 0 on success, 1 on any error.
 *
 * Time complexity  : O(m log m + m × p)  where m = migration files, p = avg SQL ops per file.
 * Space complexity : O(m) for the applied-set lookup map (in-memory hash set).
 *
 * Usage
 * ─────
 *   ts-node src/db/migrate.ts                  # run pending migrations
 *   ts-node src/db/migrate.ts --dry-run         # print/generate the plan only
 *   ts-node src/db/migrate.ts --skip-backup     # skip the pre-migration pg_dump (dev only)
 *   ts-node src/db/migrate.ts --rollback        # roll back the most recently applied migration
 *   ts-node src/db/migrate.ts --rollback 3      # roll back the last 3 migrations
 *   ts-node src/db/migrate.ts --rollback --dry-run
 *
 * Environment variables
 * ──────────────────────
 *   DATABASE_URL            - required for any real run or rollback
 *   MIGRATION_SKIP_BACKUP   - 'true' to skip the pre-migration pg_dump backup
 *   MIGRATION_BACKUP_DIR    - where pg_dump backups are written (default: backend/backups)
 */

import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

// ─── Bootstrap ──────────────────────────────────────────────────────────────

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

// ─── Constants ───────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');
const ROLLBACKS_DIR = path.resolve(__dirname, 'rollbacks');

/** Postgres advisory lock key used to serialize concurrent migration runs. */
export const MIGRATION_LOCK_KEY = 827_100_239;

/** Maximum time (ms) the runner will wait to acquire the migration lock (#1039). */
export const LOCK_TIMEOUT_MS = 30_000;

/** Interval between advisory-lock acquisition attempts. */
const LOCK_POLL_INTERVAL_MS = 250;

/**
 * The tracking tables are always the first thing the runner creates.
 * This DDL is intentionally inline (not read from a migration file) so the
 * runner can bootstrap itself before any file-based migration is evaluated,
 * and so `migration_run_log` exists even on a run that also applies the
 * migration file which formally introduces it (055_create_migration_run_log.sql).
 */
const BOOTSTRAP_SQL = `
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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppliedMigration {
  filename: string;
  checksum: string;
}

export interface MigrationFile {
  filename: string;
  absolutePath: string;
  sql: string;
  checksum: string;
}

export interface VerificationResult {
  passed: boolean;
  issues: string[];
}

export interface BackupResult {
  taken: boolean;
  path?: string;
  error?: string;
}

export interface RunResult {
  applied: string[];
  skipped: string[];
  driftDetected: string[];
  failures: string[];
  backup?: BackupResult;
  sqlPlanPath?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hex digest of a string.
 * Pure function with O(n) time and O(1) extra space (streaming hash).
 */
export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Guard: scan the migration filenames and throw if any two files share the
 * same numeric prefix (e.g. two files both starting with "010_").
 *
 * Duplicate prefixes are the primary root cause of checksum-mismatch failures
 * in CI/CD because they corrupt the deterministic sort-order contract that the
 * runner relies on. Throwing here gives the developer an immediately actionable
 * error message instead of a cryptic drift error deeper in the pipeline.
 *
 * Time complexity : O(m) — single pass over the filename array.
 * @throws {Error} a formatted, multi-line description of every duplicate found.
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
 * Return all *.sql files from `dir`, sorted lexicographically.
 * Consistent sort order means numeric prefixes (001_, 012_) define
 * execution sequence without any external configuration.
 *
 * @throws {Error} if the directory cannot be read.
 */
export function readMigrationFiles(dir: string): MigrationFile[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic; '001_' < '012_' because '0' < '1'

  return files.map((filename) => {
    const absolutePath = path.join(dir, filename);
    const sql = fs.readFileSync(absolutePath, 'utf8');
    const checksum = sha256(sql);
    return { filename, absolutePath, sql, checksum };
  });
}

/**
 * Fetch the set of already-applied migrations from the tracking table.
 * Returns a Map<filename, AppliedMigration> for O(1) lookup per file.
 */
async function fetchAppliedMigrations(client: PoolClient): Promise<Map<string, AppliedMigration>> {
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
async function recordMigration(
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
 * Append a row to `migration_run_log` describing one execution attempt
 * (success, failure, or dry-run) so the migration status endpoint can
 * surface a full history — including failures — to operators (#1039).
 * Uses its own statement (not nested in the failed migration's now-rolled-back
 * transaction) so the log entry always persists regardless of outcome.
 */
export async function recordRunLog(
  client: PoolClient,
  entry: {
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

// ─── Advisory lock (30s timeout) ─────────────────────────────────────────────

/**
 * Acquire a session-level Postgres advisory lock so two migration runners can
 * never apply migrations concurrently against the same database. Polls
 * `pg_try_advisory_lock` (non-blocking) and gives up after `LOCK_TIMEOUT_MS`
 * (30 seconds) so a stuck lock-holder cannot wedge deploys indefinitely (#1039).
 *
 * Also sets the session `lock_timeout` so any row/table lock the migration's
 * own DDL waits on inside its transaction is bounded by the same 30s budget.
 */
export async function acquireMigrationLock(
  client: PoolClient,
  timeoutMs: number = LOCK_TIMEOUT_MS
): Promise<void> {
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

/** Release the migration advisory lock acquired by {@link acquireMigrationLock}. */
export async function releaseMigrationLock(client: PoolClient): Promise<void> {
  await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
}

// ─── Pre-migration backup (pg_dump) ──────────────────────────────────────────

/** Resolves the directory pg_dump backups are written to. */
export function resolveBackupDir(): string {
  return process.env.MIGRATION_BACKUP_DIR
    ? path.resolve(process.env.MIGRATION_BACKUP_DIR)
    : path.resolve(__dirname, '../../backups');
}

/**
 * Build the `pg_dump` argv for a custom-format, pre-migration backup.
 * Pure function — no I/O — so it can be unit tested without a real database
 * or `pg_dump` binary.
 */
export function buildPgDumpArgs(databaseUrl: string, outputPath: string): string[] {
  return [databaseUrl, '--format=custom', '--no-owner', '--no-privileges', `--file=${outputPath}`];
}

/**
 * Take a `pg_dump` backup of the target database before running any pending
 * migration. On by default for the real runner; skippable via `--skip-backup`
 * or `MIGRATION_SKIP_BACKUP=true` for local/dev iteration (#1039).
 */
export async function takePreMigrationBackup(databaseUrl: string): Promise<BackupResult> {
  const dir = resolveBackupDir();

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return {
      taken: false,
      error: `Could not create backup directory "${dir}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const filename = `pre-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
  const outputPath = path.join(dir, filename);
  const args = buildPgDumpArgs(databaseUrl, outputPath);

  try {
    await execFileAsync('pg_dump', args, { timeout: 5 * 60_000 });
    return { taken: true, path: outputPath };
  } catch (err) {
    return { taken: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Post-migration verification ─────────────────────────────────────────────

/**
 * Post-migration schema-integrity verification. Runs generic, migration-agnostic
 * checks that catch the most common failure modes of a partially-applied or
 * silently-broken migration:
 *   - Any index left `NOT VALID` (e.g. an aborted `CREATE INDEX CONCURRENTLY`).
 *   - Any constraint left `NOT VALIDATED` (e.g. an aborted `VALIDATE CONSTRAINT`).
 * Executed inside the migration's own transaction, before COMMIT, so a failed
 * verification still triggers a full ROLLBACK of that migration (#1039).
 */
export async function verifySchemaIntegrity(client: PoolClient): Promise<VerificationResult> {
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

// ─── Failure alerting + auto-rollback ────────────────────────────────────────

/**
 * Log a structured, high-visibility alert for a failed migration.
 * Follows the same "structured log + TODO wiring" pattern used elsewhere in
 * the codebase for ops alerts (see backupVerificationWorker.ts) — this repo
 * has no external alerting service configured yet (no Sentry/PagerDuty), so
 * the alert is a loud, greppable log line that a log-based alert rule (e.g.
 * Elasticsearch/Kibana watcher on `alert: "MIGRATION_FAILED"`) can trigger on.
 */
export function alertMigrationFailure(filename: string, error: unknown): void {
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

// ─── Dry-run plan generation ──────────────────────────────────────────────────

/**
 * Render the full SQL that WOULD run for a set of pending migrations, as a
 * single reviewable script — this is the literal "SQL that would run" the
 * dry-run acceptance criterion asks for, not just a list of filenames (#1039).
 * Pure function — no I/O — so it is unit-testable without touching disk.
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

async function runMigrations(skipBackup: boolean): Promise<RunResult> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    // Keep the pool minimal; the runner is a CLI tool, not a long-lived server.
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

  const result: RunResult = { applied: [], skipped: [], driftDetected: [], failures: [] };

  const client = await pool.connect();

  try {
    // ── Step 0: Acquire the migration advisory lock (30s timeout, #1039) ──
    await acquireMigrationLock(client);
    console.log('[migrate] ✓ Acquired migration advisory lock');

    // ── Step 1: Bootstrap tracking tables ──────────────────────────────────
    await client.query(BOOTSTRAP_SQL);
    console.log('[migrate] ✓ schema_migrations / migration_run_log tables ready');

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
        alertMigrationFailure(file.filename, err);

        const rollbackSucceeded = await attemptAutoRollback(client, file.filename);

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

    // ── Step 6: Abort if drift was detected at any point ──────────────────
    if (result.driftDetected.length > 0) {
      throw new Error(
        `Content drift detected in ${result.driftDetected.length} migration(s): ` +
          result.driftDetected.join(', ')
      );
    }
  } finally {
    await releaseMigrationLock(client).catch(() => {
      // Best-effort: the session ending will also release the lock.
    });
    client.release();
    await pool.end();
  }

  return result;
}

// ─── Rollback runner ─────────────────────────────────────────────────────────

/**
 * Roll back the N most-recently applied migrations (default: 1).
 *
 * For each migration to be rolled back (in reverse-applied-at order) the
 * runner looks for a matching file in the `rollbacks/` directory next to
 * `migrations/`. The rollback SQL is executed inside a transaction and the
 * corresponding `schema_migrations` row is deleted on success so the
 * migration can be re-applied later.
 *
 * Usage:
 *   ts-node src/db/migrate.ts --rollback         # roll back 1 migration
 *   ts-node src/db/migrate.ts --rollback 3       # roll back 3 migrations
 *   ts-node src/db/migrate.ts --rollback --dry-run
 */
async function runRollback(steps: number, isDryRun: boolean): Promise<void> {
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
    // Fetch applied migrations in reverse order (most recently applied first).
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

        await client
          .query(
            `INSERT INTO migration_rollback_log (filename, execution_ms, reason)
             VALUES ($1, $2, $3)`,
            [filename, executionMs, 'Manual rollback via migrate.ts --rollback']
          )
          .catch(() => {
            // migration_rollback_log may not exist yet (pre-044 database); non-fatal.
          });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`[migrate] ✗ Rollback failed for  ${filename}`);
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  const skipBackup = process.argv.includes('--skip-backup') || process.env.MIGRATION_SKIP_BACKUP === 'true';
  const rollbackIdx = process.argv.indexOf('--rollback');
  const isRollback = rollbackIdx !== -1;

  console.log(`[migrate] Starting migration runner${isDryRun ? ' (DRY RUN)' : ''}`);

  // A pure forward dry-run can run entirely offline; everything else needs DATABASE_URL.
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
      // The optional value after --rollback specifies how many steps to roll back.
      const nextArg = process.argv[rollbackIdx + 1];
      const steps = nextArg && /^\d+$/.test(nextArg) ? parseInt(nextArg, 10) : 1;
      console.log(`[migrate] Mode: ROLLBACK (${steps} step${steps === 1 ? '' : 's'})`);
      await runRollback(steps, isDryRun);
    } else if (isDryRun) {
      await runDryRun();
    } else {
      const result = await runMigrations(skipBackup);

      const totalMs = Date.now() - startMs;

      console.log('');
      console.log('─────────────────────────────────────────');
      console.log(`[migrate] Summary  (${totalMs} ms total)`);
      console.log(`  Applied : ${result.applied.length}`);
      console.log(`  Skipped : ${result.skipped.length}`);
      console.log(`  Failed  : ${result.failures.length}`);
      console.log(`  Drift   : ${result.driftDetected.length}`);
      console.log('─────────────────────────────────────────');
    }

    const totalMs = Date.now() - startMs;
    console.log(`[migrate] Done.  (${totalMs} ms)`);
    process.exit(0);
  } catch (err) {
    console.error('[migrate] Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

/**
 * Replace the password segment of a connection URL with asterisks so it
 * is safe to print in logs.
 * e.g. postgresql://user:secret@host:5432/db → postgresql://user:***@host:5432/db
 */
export function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    // Not a valid URL — return a fully redacted placeholder.
    return '[redacted]';
  }
}

// Only auto-run when this file is executed directly (e.g. `ts-node src/db/migrate.ts`),
// never when imported by another module (such as a Jest test importing the
// exported pure helpers above) — this is the standard Node/ESM "is main module" check.
const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  main();
}

export { main, runMigrations, runRollback, runDryRun };
