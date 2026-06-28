import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');
const ROLLBACKS_DIR = path.resolve(__dirname, '../db/rollbacks');

export interface AppliedMigration {
  id: number;
  filename: string;
  checksum: string;
  applied_at: Date;
  applied_by: string;
  execution_ms: number | null;
}

export interface MigrationFileInfo {
  filename: string;
  hasRollback: boolean;
  checksum: string;
}

export interface MigrationStatusReport {
  appliedCount: number;
  pendingCount: number;
  applied: AppliedMigration[];
  pending: MigrationFileInfo[];
  rollbackHistory: RollbackEvent[];
}

export interface RollbackEvent {
  id: number;
  filename: string;
  rolled_back_at: Date;
  rolled_back_by: string;
  reason: string | null;
  execution_ms: number | null;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function readMigrationFilenames(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function rollbackExists(filename: string): boolean {
  return fs.existsSync(path.join(ROLLBACKS_DIR, filename));
}

export class MigrationStatusService {
  async getStatus(): Promise<MigrationStatusReport> {
    const appliedRows = await pool.query<AppliedMigration>(
      'SELECT id, filename, checksum, applied_at, applied_by, execution_ms FROM schema_migrations ORDER BY id ASC'
    );
    const appliedSet = new Map(appliedRows.rows.map((r) => [r.filename, r]));

    const allFiles = readMigrationFilenames();
    const pending: MigrationFileInfo[] = [];

    for (const filename of allFiles) {
      if (!appliedSet.has(filename)) {
        const absolutePath = path.join(MIGRATIONS_DIR, filename);
        const sql = fs.readFileSync(absolutePath, 'utf8');
        pending.push({
          filename,
          hasRollback: rollbackExists(filename),
          checksum: sha256(sql),
        });
      }
    }

    let rollbackHistory: RollbackEvent[] = [];
    try {
      const rbRows = await pool.query<RollbackEvent>(
        `SELECT id, filename, rolled_back_at, rolled_back_by, reason, execution_ms
         FROM migration_rollback_log
         ORDER BY rolled_back_at DESC
         LIMIT 50`
      );
      rollbackHistory = rbRows.rows;
    } catch {
      // Table may not exist yet (pre-044 migration); return empty history.
      logger.debug('migration_rollback_log table not yet available');
    }

    return {
      appliedCount: appliedRows.rows.length,
      pendingCount: pending.length,
      applied: appliedRows.rows,
      pending,
      rollbackHistory,
    };
  }

  async getApplied(): Promise<AppliedMigration[]> {
    const result = await pool.query<AppliedMigration>(
      'SELECT id, filename, checksum, applied_at, applied_by, execution_ms FROM schema_migrations ORDER BY id ASC'
    );
    return result.rows;
  }

  async getRollbackHistory(limit = 20): Promise<RollbackEvent[]> {
    try {
      const result = await pool.query<RollbackEvent>(
        `SELECT id, filename, rolled_back_at, rolled_back_by, reason, execution_ms
         FROM migration_rollback_log
         ORDER BY rolled_back_at DESC
         LIMIT $1`,
        [Math.min(limit, 100)]
      );
      return result.rows;
    } catch {
      logger.debug('migration_rollback_log table not yet available');
      return [];
    }
  }
}
