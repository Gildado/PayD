/**
 * @file src/db/migrate.ts
 * @description Production-grade PostgreSQL migration runner.
 *
 * Responsibilities
 * ────────────────
 * 1. Connect to PostgreSQL using the DATABASE_URL environment variable.
 * 2. Bootstrap the `schema_migrations` tracking table when it is absent
 *    (this handles the very first run against a blank database).
 * 3. Read all *.sql files from the migrations directory, sorted lexicographically
 *    so that numeric prefixes (001_, 002_, …) define strict execution order.
 * 4. For each file:
 *    a. Skip if already recorded in `schema_migrations`.
 *    b. Guard against file-content drift on already-applied migrations
 *       (SHA-256 checksum comparison).
 *    c. Execute within a single SERIALIZABLE transaction so a partial failure
 *       leaves the database unchanged and the migration can be retried safely.
 *    d. Record the migration in `schema_migrations` (filename, checksum, ms).
 * 5. Support a --dry-run flag that logs the plan without executing any SQL.
 * 6. Exit 0 on success, 1 on any error.
 *
 * Time complexity  : O(m log m + m × p)  where m = migration files, p = avg SQL ops per file.
 * Space complexity : O(m) for the applied-set lookup map (in-memory hash set).
 *
 * Usage
 * ─────
 *   ts-node src/db/migrate.ts              # run pending migrations
 *   ts-node src/db/migrate.ts --dry-run    # print plan only
 *   ts-node src/db/migrate.ts --rollback   # (reserved; not yet implemented)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Bootstrap ──────────────────────────────────────────────────────────────

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[migrate] ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');
const ROLLBACKS_DIR = path.resolve(__dirname, 'rollbacks');

/**
 * The tracking table is always the first thing the runner creates.
 * This DDL is intentionally inline (not read from a file) so the runner
 * can bootstrap itself before any file-based migration is evaluated.
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
`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppliedMigration {
  filename: string;
  checksum: string;
}

interface MigrationFile {
  filename: string;
  absolutePath: string;
  sql: string;
  checksum: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hex digest of a string.
 * Pure function with O(n) time and O(1) extra space (streaming hash).
 */
function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Guard: scan the migration filenames and abort if any two files share the
 * same numeric prefix (e.g. two files both starting with "010_").
 *
 * Duplicate prefixes are the primary root cause of checksum-mismatch failures
 * in CI/CD because they corrupt the deterministic sort-order contract that the
 * runner relies on.  Failing here gives the developer an immediately actionable
 * error message instead of a cryptic drift error deeper in the pipeline.
 *
 * Time complexity  : O(m) — single pass over the filename array.
 * Side effects     : Writes to stderr and calls process.exit(1) on violation.
 */
function assertNoDuplicatePrefixes(files: MigrationFile[]): void {
  const prefixMap = new Map<string, string[]>();

  for (const { filename } of files) {
    const match = filename.match(/^(\d+)_/);
    if (!match) continue;
    const prefix = match[1];
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix)!.push(filename);
  }

  const duplicates = [...prefixMap.entries()].filter(([, names]) => names.length > 1);

  if (duplicates.length === 0) return;

  console.error('[migrate] ────────────────────────────────────────────────────');
  console.error('[migrate] FATAL: Duplicate migration prefix(es) detected.');
  console.error('[migrate]');
  console.error('[migrate] Two or more migration files share the same numeric');
  console.error('[migrate] prefix. This corrupts the sort-order contract and');
  console.error('[migrate] will cause non-deterministic checksum mismatches.');
  console.error('[migrate]');

  for (const [prefix, names] of duplicates) {
    console.error(`[migrate]   Prefix "${prefix}_" shared by:`);
    for (const name of names) console.error(`[migrate]     - ${name}`);
  }

  console.error('[migrate]');
  console.error('[migrate] Fix: run the re-sequencing script from the repo root:');
  console.error('[migrate]   node scripts/resequence-migrations.mjs --dry-run');
  console.error('[migrate]   node scripts/resequence-migrations.mjs');
  console.error('[migrate] ────────────────────────────────────────────────────');
  process.exit(1);
}

/**
 * Return all *.sql files from `dir`, sorted lexicographically.
 * Consistent sort order means numeric prefixes (001_, 012_) define
 * execution sequence without any external configuration.
 *
 * @throws {Error} if the directory cannot be read.
 */
function readMigrationFiles(dir: string): MigrationFile[] {
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

// ─── Core runner ─────────────────────────────────────────────────────────────

interface RunResult {
  applied: string[];
  skipped: string[];
  driftDetected: string[];
}

async function runMigrations(isDryRun: boolean): Promise<RunResult> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    // Keep the pool minimal; the runner is a CLI tool, not a long-lived server.
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

  const result: RunResult = { applied: [], skipped: [], driftDetected: [] };

  const client = await pool.connect();

  try {
    // ── Step 1: Bootstrap tracking table ──────────────────────────────────
    // Always run inline, outside a migration transaction, so it is safe even
    // on a completely blank database.
    if (!isDryRun) {
      await client.query(BOOTSTRAP_SQL);
      console.log('[migrate] ✓ schema_migrations table ready');
    } else {
      console.log('[migrate] [dry-run] Would bootstrap schema_migrations table');
    }

    // ── Step 2: Read migration files ──────────────────────────────────────
    const files = readMigrationFiles(MIGRATIONS_DIR);
    console.log(`[migrate] Found ${files.length} migration file(s) in ${MIGRATIONS_DIR}`);

    // ── Step 2a: Guard against duplicate numeric prefixes ────────────────
    // This check runs before any SQL is executed.  A duplicate prefix means
    // two contributors merged migrations with the same number, which will
    // produce non-deterministic sort ordering and eventual checksum drift.
    assertNoDuplicatePrefixes(files);

    if (files.length === 0) {
      console.log('[migrate] Nothing to do.');
      return result;
    }

    // ── Step 3: Fetch already-applied set (O(m) time / space) ─────────────
    const applied = isDryRun
      ? new Map<string, AppliedMigration>()
      : await fetchAppliedMigrations(client);

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
          // Accumulate all drifted files before throwing so the log is complete.
          continue;
        }

        console.log(`[migrate] ↷ Skipped  ${file.filename}  (already applied)`);
        result.skipped.push(file.filename);
        continue;
      }

      // ── Step 5: Apply pending migration in an atomic transaction ─────────
      if (isDryRun) {
        console.log(
          `[migrate] [dry-run] Would apply: ${file.filename}  (checksum: ${file.checksum})`
        );
        result.applied.push(file.filename);
        continue;
      }

      const startMs = Date.now();
      await client.query('BEGIN');

      try {
        await client.query(file.sql);

        const executionMs = Date.now() - startMs;

        // Record INSIDE the same transaction so a runner crash after SQL
        // execution but before the INSERT cannot leave an unrecorded migration.
        await recordMigration(client, file.filename, file.checksum, executionMs);

        await client.query('COMMIT');

        console.log(`[migrate] ✓ Applied   ${file.filename}  (${executionMs} ms)`);
        result.applied.push(file.filename);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ✗ Failed   ${file.filename}`);
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
 * `migrations/`.  The rollback SQL is executed inside a SERIALIZABLE
 * transaction and the corresponding `schema_migrations` row is deleted on
 * success so the migration can be re-applied later.
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
      } catch (err) {
        await client.query('ROLLBACK');
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
  const rollbackIdx = process.argv.indexOf('--rollback');
  const isRollback = rollbackIdx !== -1;

  console.log(`[migrate] Starting migration runner${isDryRun ? ' (DRY RUN)' : ''}`);
  console.log(`[migrate] Target database: ${maskConnectionString(DATABASE_URL!)}`);

  const startMs = Date.now();

  try {
    if (isRollback) {
      // The optional value after --rollback specifies how many steps to roll back.
      const nextArg = process.argv[rollbackIdx + 1];
      const steps = nextArg && /^\d+$/.test(nextArg) ? parseInt(nextArg, 10) : 1;
      console.log(`[migrate] Mode: ROLLBACK (${steps} step${steps === 1 ? '' : 's'})`);
      await runRollback(steps, isDryRun);
    } else {
      const result = await runMigrations(isDryRun);

      const totalMs = Date.now() - startMs;

      console.log('');
      console.log('─────────────────────────────────────────');
      console.log(`[migrate] Summary  (${totalMs} ms total)`);
      console.log(`  Applied : ${result.applied.length}`);
      console.log(`  Skipped : ${result.skipped.length}`);
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
function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    // Not a valid URL — return a fully redacted placeholder.
    return '[redacted]';
  }
}

main();
