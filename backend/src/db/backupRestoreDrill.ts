import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Pool } from 'pg';

const execFileAsync = promisify(execFile);

export interface RestoreCommand {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export interface RestoreDrillOptions {
  backupPath: string;
  targetDatabase: string;
  databaseUrl: string;
  pgRestorePath?: string;
}

export interface RestoreDrillChecks {
  tableCount: { expected: number; actual: number; passed: boolean };
  constraintCheck: { passed: boolean; errors: string[] };
  dataIntegrity: { passed: boolean; errors: string[] };
}

export interface RestoreDrillResult {
  success: boolean;
  backupPath: string;
  targetDatabase: string;
  checks: RestoreDrillChecks;
  restoredAt: Date;
  error?: string;
}

export function buildPgRestoreCommand(options: RestoreDrillOptions): RestoreCommand {
  const dbUrl = new URL(options.databaseUrl);
  const command = options.pgRestorePath || process.env.PG_RESTORE_BIN || 'pg_restore';
  const args = [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--host',
    dbUrl.hostname,
    '--port',
    dbUrl.port || '5432',
    '--username',
    decodeURIComponent(dbUrl.username),
    '--dbname',
    options.targetDatabase,
    options.backupPath,
  ];

  return {
    command,
    args,
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(dbUrl.password),
    },
  };
}

export async function restoreCustomFormatBackup(
  options: RestoreDrillOptions
): Promise<void> {
  const restore = buildPgRestoreCommand(options);
  await execFileAsync(restore.command, restore.args, {
    env: restore.env,
    maxBuffer: 100 * 1024 * 1024,
  });
}

export async function runRestoreIntegrityChecks(
  sourcePool: Pool,
  restoredPool: Pool,
  criticalTables = ['employees', 'payroll_runs', 'payroll_items', 'users']
): Promise<RestoreDrillChecks> {
  const sourceTables = await sourcePool.query(
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
  );
  const restoredTables = await restoredPool.query(
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
  );

  const expected = Number(sourceTables.rows[0]?.count ?? 0);
  const actual = Number(restoredTables.rows[0]?.count ?? 0);

  const constraintErrors: string[] = [];
  const constraints = await restoredPool.query(
    `SELECT conname, conrelid::regclass AS table_name
     FROM pg_constraint
     WHERE contype IN ('c', 'f')
       AND connamespace = 'public'::regnamespace`
  );

  for (const constraint of constraints.rows) {
    try {
      await restoredPool.query(
        `ALTER TABLE ${constraint.table_name} VALIDATE CONSTRAINT ${constraint.conname}`
      );
    } catch (error) {
      constraintErrors.push(
        `${constraint.table_name}.${constraint.conname}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const dataErrors: string[] = [];
  for (const table of criticalTables) {
    try {
      const sourceCount = await sourcePool.query(`SELECT COUNT(*) FROM ${table}`);
      const restoredCount = await restoredPool.query(`SELECT COUNT(*) FROM ${table}`);
      const sourceRows = Number(sourceCount.rows[0]?.count ?? 0);
      const restoredRows = Number(restoredCount.rows[0]?.count ?? 0);

      if (sourceRows !== restoredRows) {
        dataErrors.push(`${table}: source=${sourceRows}, restored=${restoredRows}`);
      }
    } catch (error) {
      dataErrors.push(
        `${table}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    tableCount: { expected, actual, passed: expected === actual },
    constraintCheck: { passed: constraintErrors.length === 0, errors: constraintErrors },
    dataIntegrity: { passed: dataErrors.length === 0, errors: dataErrors },
  };
}

export async function performRestoreDrill(
  options: RestoreDrillOptions,
  sourcePool: Pool,
  restoredPool: Pool
): Promise<RestoreDrillResult> {
  try {
    await restoreCustomFormatBackup(options);
    const checks = await runRestoreIntegrityChecks(sourcePool, restoredPool);
    const success =
      checks.tableCount.passed &&
      checks.constraintCheck.passed &&
      checks.dataIntegrity.passed;

    return {
      success,
      backupPath: options.backupPath,
      targetDatabase: options.targetDatabase,
      checks,
      restoredAt: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      backupPath: options.backupPath,
      targetDatabase: options.targetDatabase,
      checks: {
        tableCount: { expected: 0, actual: 0, passed: false },
        constraintCheck: { passed: false, errors: [] },
        dataIntegrity: { passed: false, errors: [] },
      },
      restoredAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
