// #1278 — Backup verification orchestration workflow
import { Workflow, Step } from '@mastra/core';
import { Logger } from '@nestjs/common';

const logger = new Logger('BackupVerificationWorkflow');

const validateBackupConfigStep = new Step({
  id: 'validateBackupConfig',
  execute: async ({ inputData }) => {
    logger.log(`Validating backup verification config for job: ${inputData?.backupId}`);
    if (!inputData?.backupId) {
      throw new Error('Invalid backup verification payload: backupId is required.');
    }
    return { ...inputData, validatedAt: new Date().toISOString() };
  },
});

const restoreBackupStep = new Step({
  id: 'restoreBackup',
  execute: async ({ inputData }) => {
    logger.log(`Restoring backup ${inputData.backupId} to test database`);
    // Calls backupVerificationWorker's restore logic
    const { execSync } = await import('child_process');
    const testDb = `payd_backup_test_${Date.now()}`;
    try {
      execSync(`pg_restore --no-owner --no-acl -d ${testDb} ${inputData.backupPath}`, {
        timeout: 300000,
      });
      return { ...inputData, testDb, restored: true };
    } catch (err) {
      throw new Error(`Backup restore failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  },
  retryConfig: { attempts: 3, delay: 5000 },
});

const runIntegrityChecksStep = new Step({
  id: 'runIntegrityChecks',
  execute: async ({ inputData }) => {
    logger.log(`Running integrity checks on restored database ${inputData.testDb}`);
    const { Pool } = await import('pg');
    const pool = new Pool({ database: inputData.testDb });
    try {
      const { rows } = await pool.query(
        `SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const tableCount = Number(rows[0]?.table_count ?? 0);
      if (tableCount === 0) {
        throw new Error('Integrity check failed: no tables found in restored backup');
      }
      return { ...inputData, tableCount, integrityPassed: true };
    } finally {
      await pool.end();
    }
  },
  retryConfig: { attempts: 2, delay: 2000 },
});

const cleanupAndReportStep = new Step({
  id: 'cleanupAndReport',
  execute: async ({ inputData }) => {
    logger.log(`Cleaning up test database and reporting results for ${inputData.backupId}`);
    const { execSync } = await import('child_process');
    try {
      execSync(`dropdb --if-exists ${inputData.testDb}`);
    } catch {
      logger.warn(`Failed to drop test database ${inputData.testDb}`);
    }
    return {
      success: true,
      backupId: inputData.backupId,
      tableCount: inputData.tableCount,
      completedAt: new Date().toISOString(),
    };
  },
});

export const backupVerificationWorkflow = new Workflow({
  name: 'backup-verification-orchestration',
  steps: [validateBackupConfigStep, restoreBackupStep, runIntegrityChecksStep, cleanupAndReportStep],
});

backupVerificationWorkflow
  .then(validateBackupConfigStep)
  .then(restoreBackupStep)
  .then(runIntegrityChecksStep)
  .then(cleanupAndReportStep);
