/**
 * Unit tests for the migration safety features added for Issue #1039:
 * pre-migration backup command construction, dry-run SQL generation,
 * duplicate-prefix detection, the 30s advisory lock, post-migration schema
 * verification, and the run-log / auto-rollback recording used on failure.
 *
 * These tests exercise only the pure/unit-testable logic with mocked
 * pg clients and a mocked `child_process.execFile` — no real Postgres,
 * no real `pg_dump` binary, and no real Stellar/Redis/etc. dependency is
 * ever contacted.
 */
import path from 'path';
import fs from 'fs';
import os from 'os';

import {
  sha256,
  assertNoDuplicatePrefixes,
  buildPgDumpArgs,
  resolveBackupDir,
  renderDryRunPlan,
  verifySchemaIntegrity,
  acquireMigrationLock,
  releaseMigrationLock,
  recordRunLog,
  attemptAutoRollback,
  maskConnectionString,
  MIGRATION_LOCK_KEY,
  LOCK_TIMEOUT_MS,
  type MigrationFile,
} from '../migrate.js';

function makeFile(filename: string, sql = 'SELECT 1;'): MigrationFile {
  return { filename, absolutePath: `/fake/${filename}`, sql, checksum: sha256(sql) };
}

function makeMockClient(queryImpl: (sql: string, params?: unknown[]) => any) {
  return { query: jest.fn(queryImpl) } as any;
}

describe('migrate.ts safety features (#1039)', () => {
  describe('sha256', () => {
    it('is deterministic and content-sensitive', () => {
      expect(sha256('a')).toBe(sha256('a'));
      expect(sha256('a')).not.toBe(sha256('b'));
      expect(sha256('a')).toHaveLength(64);
    });
  });

  describe('assertNoDuplicatePrefixes', () => {
    it('does not throw when all prefixes are unique', () => {
      const files = [makeFile('001_a.sql'), makeFile('002_b.sql'), makeFile('003_c.sql')];
      expect(() => assertNoDuplicatePrefixes(files)).not.toThrow();
    });

    it('throws a descriptive error when two files share a numeric prefix', () => {
      const files = [makeFile('001_a.sql'), makeFile('001_b.sql'), makeFile('002_c.sql')];
      expect(() => assertNoDuplicatePrefixes(files)).toThrow(/Duplicate migration prefix/);
      expect(() => assertNoDuplicatePrefixes(files)).toThrow(/001_a\.sql/);
      expect(() => assertNoDuplicatePrefixes(files)).toThrow(/001_b\.sql/);
    });

    it('confirms the real migrations directory has no duplicate prefixes', () => {
      // Regression guard for the 050_/050_ collision found and fixed in #1039.
      const dir = path.resolve(__dirname, '../migrations');
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((filename) => makeFile(filename, fs.readFileSync(path.join(dir, filename), 'utf8')));
      expect(() => assertNoDuplicatePrefixes(files)).not.toThrow();
    });
  });

  describe('buildPgDumpArgs', () => {
    it('builds a custom-format pg_dump argv with the output path', () => {
      const args = buildPgDumpArgs('postgres://user:pass@host:5432/db', '/tmp/backup.dump');
      expect(args).toEqual([
        'postgres://user:pass@host:5432/db',
        '--format=custom',
        '--no-owner',
        '--no-privileges',
        '--file=/tmp/backup.dump',
      ]);
    });
  });

  describe('resolveBackupDir', () => {
    const original = process.env.MIGRATION_BACKUP_DIR;
    afterEach(() => {
      if (original === undefined) delete process.env.MIGRATION_BACKUP_DIR;
      else process.env.MIGRATION_BACKUP_DIR = original;
    });

    it('honors MIGRATION_BACKUP_DIR when set', () => {
      process.env.MIGRATION_BACKUP_DIR = '/tmp/custom-backups';
      expect(resolveBackupDir()).toBe(path.resolve('/tmp/custom-backups'));
    });

    it('falls back to backend/backups when unset', () => {
      delete process.env.MIGRATION_BACKUP_DIR;
      expect(resolveBackupDir()).toBe(path.resolve(__dirname, '../../../backups'));
    });
  });

  describe('renderDryRunPlan', () => {
    it('renders the literal SQL that would run, without executing it', () => {
      const pending = [makeFile('010_add_column.sql', 'ALTER TABLE foo ADD COLUMN bar INT;')];
      const plan = renderDryRunPlan(pending);

      expect(plan).toContain('Dry-run migration plan generated');
      expect(plan).toContain('1 pending migration(s)');
      expect(plan).toContain('010_add_column.sql');
      expect(plan).toContain('ALTER TABLE foo ADD COLUMN bar INT;');
    });

    it('renders an empty plan when nothing is pending', () => {
      const plan = renderDryRunPlan([]);
      expect(plan).toContain('0 pending migration(s)');
    });
  });

  describe('verifySchemaIntegrity', () => {
    it('passes when there are no invalid indexes or unvalidated constraints', async () => {
      const client = makeMockClient(async (sql: string) => {
        if (sql.includes('pg_index')) return { rows: [] };
        if (sql.includes('pg_constraint')) return { rows: [] };
        throw new Error(`unexpected query: ${sql}`);
      });

      const result = await verifySchemaIntegrity(client);
      expect(result.passed).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('fails and reports issues when an invalid index or constraint is found', async () => {
      const client = makeMockClient(async (sql: string) => {
        if (sql.includes('pg_index')) return { rows: [{ name: 'idx_broken' }] };
        if (sql.includes('pg_constraint')) return { rows: [{ conname: 'chk_bad', table_name: 'employees' }] };
        throw new Error(`unexpected query: ${sql}`);
      });

      const result = await verifySchemaIntegrity(client);
      expect(result.passed).toBe(false);
      expect(result.issues).toEqual([
        'Invalid (not-ready) index left behind: idx_broken',
        'Unvalidated constraint left behind: "chk_bad" on employees',
      ]);
    });
  });

  describe('acquireMigrationLock / releaseMigrationLock (30s timeout)', () => {
    it('exports a 30 second timeout constant', () => {
      expect(LOCK_TIMEOUT_MS).toBe(30_000);
    });

    it('acquires immediately when pg_try_advisory_lock returns true', async () => {
      const calls: string[] = [];
      const client = makeMockClient(async (sql: string) => {
        calls.push(sql);
        if (sql.startsWith('SET lock_timeout')) return { rows: [] };
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
        return { rows: [] };
      });

      await expect(acquireMigrationLock(client, 5_000)).resolves.toBeUndefined();
      expect(calls.some((c) => c.includes(String(MIGRATION_LOCK_KEY)) || c.includes('pg_try_advisory_lock'))).toBe(
        true
      );
    });

    it('gives up and throws once the timeout elapses if the lock is never free', async () => {
      const client = makeMockClient(async (sql: string) => {
        if (sql.startsWith('SET lock_timeout')) return { rows: [] };
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: false }] };
        return { rows: [] };
      });

      // Use a tiny timeout so the test itself stays fast.
      await expect(acquireMigrationLock(client, 50)).rejects.toThrow(/Could not acquire the migration advisory lock/);
    });

    it('releases the lock via pg_advisory_unlock', async () => {
      const client = makeMockClient(async () => ({ rows: [] }));
      await releaseMigrationLock(client);
      expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    });
  });

  describe('recordRunLog', () => {
    it('inserts a success entry with the expected shape', async () => {
      const client = makeMockClient(async () => ({ rows: [] }));
      const startedAt = new Date();

      await recordRunLog(client, {
        filename: '045_add_performance_bonus_fields.sql',
        status: 'success',
        startedAt,
        executionMs: 42,
        backupTaken: true,
        backupPath: '/backups/pre-migration-x.dump',
        verificationPassed: true,
        verificationIssues: [],
      });

      expect(client.query).toHaveBeenCalledTimes(1);
      const [sql, params] = client.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO migration_run_log/);
      expect(params).toEqual([
        '045_add_performance_bonus_fields.sql',
        'success',
        startedAt,
        42,
        true,
        '/backups/pre-migration-x.dump',
        true,
        '[]',
        null,
        false,
        null,
      ]);
    });

    it('inserts a failure entry with the error message and rollback outcome', async () => {
      const client = makeMockClient(async () => ({ rows: [] }));
      const startedAt = new Date();

      await recordRunLog(client, {
        filename: '999_bad.sql',
        status: 'failure',
        startedAt,
        executionMs: 5,
        backupTaken: false,
        verificationPassed: false,
        verificationIssues: ['Invalid index: idx_x'],
        errorMessage: 'syntax error',
        rollbackAttempted: true,
        rollbackSucceeded: true,
      });

      const [, params] = client.query.mock.calls[0];
      expect(params[1]).toBe('failure');
      expect(params[8]).toBe('syntax error');
      expect(params[9]).toBe(true); // rollback_attempted
      expect(params[10]).toBe(true); // rollback_succeeded
    });
  });

  describe('attemptAutoRollback', () => {
    it('returns false when no rollback file exists for the migration', async () => {
      const client = makeMockClient(async () => ({ rows: [] }));
      const result = await attemptAutoRollback(client, 'does_not_exist_999.sql');
      expect(result).toBe(false);
      expect(client.query).not.toHaveBeenCalled();
    });

    it('executes the real rollback file and returns true on success', async () => {
      // Exercise this against a real, existing rollback file in the repo so the
      // test also acts as a smoke check that the file is valid SQL text.
      const client = makeMockClient(async () => ({ rows: [] }));
      const result = await attemptAutoRollback(client, '045_add_performance_bonus_fields.sql');

      expect(result).toBe(true);
      const executedSql = client.query.mock.calls.map((c: any[]) => c[0]).join('\n');
      expect(executedSql).toContain('BEGIN');
      expect(executedSql).toContain('DROP COLUMN IF EXISTS bonus_type');
      expect(executedSql).toContain('COMMIT');
    });

    it('rolls back its own transaction and returns false if the rollback SQL itself fails', async () => {
      const client = makeMockClient(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        throw new Error('simulated rollback failure');
      });

      const result = await attemptAutoRollback(client, '045_add_performance_bonus_fields.sql');
      expect(result).toBe(false);
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('maskConnectionString', () => {
    it('redacts the password segment', () => {
      expect(maskConnectionString('postgresql://user:secret@host:5432/db')).toBe(
        'postgresql://user:***@host:5432/db'
      );
    });

    it('returns a redacted placeholder for an unparsable URL', () => {
      expect(maskConnectionString('not-a-url')).toBe('[redacted]');
    });
  });
});

describe('runDryRun (#1039) — fully offline plan generation', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalBackupDir = process.env.MIGRATION_BACKUP_DIR;
  let scratchDir: string;

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'payd-migrate-test-'));
    process.env.MIGRATION_BACKUP_DIR = scratchDir;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalBackupDir === undefined) delete process.env.MIGRATION_BACKUP_DIR;
    else process.env.MIGRATION_BACKUP_DIR = originalBackupDir;
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it('treats every migration as pending and writes a reviewable SQL plan file when DATABASE_URL is unset', async () => {
    const { runDryRun } = await import('../migrate.js');
    const result = await runDryRun();

    const realMigrationCount = fs
      .readdirSync(path.resolve(__dirname, '../migrations'))
      .filter((f) => f.endsWith('.sql')).length;

    expect(result.applied.length).toBe(realMigrationCount);
    expect(result.failures).toEqual([]);
    expect(result.sqlPlanPath).toBeDefined();
    expect(fs.existsSync(result.sqlPlanPath!)).toBe(true);

    const planContents = fs.readFileSync(result.sqlPlanPath!, 'utf8');
    expect(planContents).toContain('001_create_tables.sql');
  });
});
