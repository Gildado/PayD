import { describe, expect, it, jest } from '@jest/globals';
import type { Pool } from 'pg';
import {
  buildPgRestoreCommand,
  runRestoreIntegrityChecks,
} from '../backupRestoreDrill.js';

describe('backupRestoreDrill', () => {
  it('builds a pg_restore command for an actual restore target', () => {
    const command = buildPgRestoreCommand({
      backupPath: '/backups/pre-migration.dump',
      targetDatabase: 'payd_restore_drill',
      databaseUrl: 'postgres://payd:s3cret@db.example.com:5433/payd',
    });

    expect(command.command).toBe('pg_restore');
    expect(command.args).toEqual(
      expect.arrayContaining([
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--host',
        'db.example.com',
        '--port',
        '5433',
        '--username',
        'payd',
        '--dbname',
        'payd_restore_drill',
        '/backups/pre-migration.dump',
      ])
    );
    expect(command.env.PGPASSWORD).toBe('s3cret');
  });

  it('passes integrity checks when restored counts and constraints match', async () => {
    const sourcePool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ count: '8' }] })
        .mockResolvedValueOnce({ rows: [{ count: '4' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }),
    } as unknown as Pool;

    const restoredPool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ count: '8' }] })
        .mockResolvedValueOnce({
          rows: [{ conname: 'employees_org_fk', table_name: 'employees' }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '4' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }),
    } as unknown as Pool;

    const checks = await runRestoreIntegrityChecks(sourcePool, restoredPool, [
      'employees',
      'payroll_runs',
    ]);

    expect(checks.tableCount).toEqual({ expected: 8, actual: 8, passed: true });
    expect(checks.constraintCheck.passed).toBe(true);
    expect(checks.dataIntegrity.passed).toBe(true);
  });

  it('fails data integrity checks on row-count drift', async () => {
    const sourcePool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ count: '8' }] })
        .mockResolvedValueOnce({ rows: [{ count: '4' }] }),
    } as unknown as Pool;

    const restoredPool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ count: '8' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }),
    } as unknown as Pool;

    const checks = await runRestoreIntegrityChecks(sourcePool, restoredPool, ['employees']);

    expect(checks.dataIntegrity.passed).toBe(false);
    expect(checks.dataIntegrity.errors[0]).toContain('employees: source=4, restored=2');
  });
});
