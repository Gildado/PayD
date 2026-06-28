import { MigrationStatusService } from '../migrationStatusService.js';
import { pool } from '../../config/database.js';

jest.mock('../../config/database.js', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import fs from 'fs';

const mockPool = pool as { query: jest.Mock };
const mockFs = fs as {
  existsSync: jest.Mock;
  readdirSync: jest.Mock;
  readFileSync: jest.Mock;
};

describe('MigrationStatusService', () => {
  let service: MigrationStatusService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MigrationStatusService();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([
      '001_create_tables.sql',
      '002_add_employees.sql',
      '003_pending_migration.sql',
    ]);
    mockFs.readFileSync.mockReturnValue('SELECT 1;');
  });

  describe('getApplied', () => {
    it('returns applied migrations from schema_migrations', async () => {
      const fakeRows = [
        {
          id: 1,
          filename: '001_create_tables.sql',
          checksum: 'abc',
          applied_at: new Date(),
          applied_by: 'postgres',
          execution_ms: 42,
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: fakeRows });

      const result = await service.getApplied();

      expect(result).toHaveLength(1);
      expect(result[0]!.filename).toBe('001_create_tables.sql');
    });

    it('returns empty array when no migrations applied', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await service.getApplied();
      expect(result).toHaveLength(0);
    });
  });

  describe('getStatus', () => {
    it('correctly identifies pending vs applied migrations', async () => {
      const appliedRows = [
        {
          id: 1,
          filename: '001_create_tables.sql',
          checksum: 'abc',
          applied_at: new Date(),
          applied_by: 'postgres',
          execution_ms: 10,
        },
        {
          id: 2,
          filename: '002_add_employees.sql',
          checksum: 'def',
          applied_at: new Date(),
          applied_by: 'postgres',
          execution_ms: 20,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: appliedRows }) // schema_migrations
        .mockResolvedValueOnce({ rows: [] }); // migration_rollback_log

      // 003_pending_migration.sql has no rollback
      mockFs.existsSync.mockImplementation((p: string) => {
        if (String(p).includes('rollbacks/003_pending_migration.sql')) return false;
        return true;
      });

      const report = await service.getStatus();

      expect(report.appliedCount).toBe(2);
      expect(report.pendingCount).toBe(1);
      expect(report.pending[0]!.filename).toBe('003_pending_migration.sql');
      expect(report.pending[0]!.hasRollback).toBe(false);
    });

    it('handles missing migration_rollback_log table gracefully', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('relation "migration_rollback_log" does not exist'));

      const report = await service.getStatus();

      expect(report.rollbackHistory).toEqual([]);
    });
  });

  describe('getRollbackHistory', () => {
    it('returns rollback events ordered by date', async () => {
      const events = [
        {
          id: 1,
          filename: '005_some_migration.sql',
          rolled_back_at: new Date(),
          rolled_back_by: 'admin',
          reason: 'hotfix',
          execution_ms: 15,
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: events });

      const result = await service.getRollbackHistory();

      expect(result).toHaveLength(1);
      expect(result[0]!.filename).toBe('005_some_migration.sql');
      expect(result[0]!.reason).toBe('hotfix');
    });

    it('clamps limit to 100', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await service.getRollbackHistory(9999);
      const callArgs = mockPool.query.mock.calls[0];
      expect(callArgs[1]).toEqual([100]);
    });

    it('returns empty array when table does not exist', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('relation does not exist'));
      const result = await service.getRollbackHistory();
      expect(result).toEqual([]);
    });
  });
});
