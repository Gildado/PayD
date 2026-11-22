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

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

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
async function runDryRun(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL ?? undefined,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const runner = new MigrationRunner(pool, MIGRATIONS_DIR, ROLLBACKS_DIR, true);
    const result = await runner.runDryRun();

    console.log(`[migrate] [dry-run] ${result.applied.length} pending migration(s); full SQL plan written to:`);
    if (result.sqlPlanPath) {
      console.log(`[migrate]   ${result.sqlPlanPath}`);
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
async function runRollback(steps: number, isDryRun: boolean): Promise<void> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

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
