/**
 * Migration Backup Manager
 * Handles pre-migration backups using pg_dump.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface BackupResult {
  taken: boolean;
  path?: string;
  error?: string;
}

export class MigrationBackup {
  /**
   * Resolves the directory pg_dump backups are written to.
   */
  static resolveBackupDir(): string {
    return process.env.MIGRATION_BACKUP_DIR
      ? path.resolve(process.env.MIGRATION_BACKUP_DIR)
      : path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../../backups');
  }

  /**
   * Build the `pg_dump` argv for a custom-format backup.
   * Pure function — no I/O — so it can be unit tested without pg_dump.
   */
  static buildPgDumpArgs(databaseUrl: string, outputPath: string): string[] {
    return [databaseUrl, '--format=custom', '--no-owner', '--no-privileges', `--file=${outputPath}`];
  }

  /**
   * Take a `pg_dump` backup of the target database.
   */
  static async take(databaseUrl: string): Promise<BackupResult> {
    const dir = this.resolveBackupDir();

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
    const args = this.buildPgDumpArgs(databaseUrl, outputPath);

    try {
      await execFileAsync('pg_dump', args, { timeout: 5 * 60_000 });
      return { taken: true, path: outputPath };
    } catch (err) {
      return { taken: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
