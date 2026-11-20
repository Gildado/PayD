import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { ExportService, type CustomReportColumn } from './exportService.js';
import { payrollQueryService } from './payroll-query.service.js';
import { type CustomReportRow } from './exportService.js';
import logger from '../utils/logger.js';

export const DEFAULT_JOB_MAX_AGE_MS = 60 * 60 * 1000;
const RETENTION_INTERVAL_MS = 5 * 60 * 1000;

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface JobBase {
  createdAt: number;
  organizationPublicKey: string;
  batchId: string;
}

type CsvJobFields = {
  startDate?: string;
  endDate?: string;
  columns: CustomReportColumn[];
};

type CompletedJobFields = {
  filePath: string;
  contentType?: string;
  filename?: string;
};

/** A single export job record. `kind` is kept for both Excel and CSV jobs. */
export type JobRecord =
  | (JobBase & { status: 'pending'; kind: 'excel' })
  | (JobBase & { status: 'processing'; kind: 'excel' })
  | (JobBase & { status: 'completed'; kind: 'excel' } & CompletedJobFields)
  | (JobBase & { status: 'pending'; kind: 'csv' } & CsvJobFields)
  | (JobBase & { status: 'processing'; kind: 'csv' } & CsvJobFields)
  | (JobBase & { status: 'completed'; kind: 'csv' } & CsvJobFields & CompletedJobFields)
  | (JobBase & { status: 'failed'; kind: 'excel' | 'csv'; error: string })
  | (JobBase & {
      status: 'cancelled';
      kind: 'excel' | 'csv';
      cancelledAt: number;
      startDate?: string;
      endDate?: string;
      columns?: CustomReportColumn[];
    });

export type CancelResult = 'cancelled' | 'not_found' | 'not_cancellable';

export interface PurgeResult {
  deletedJobs: number;
  deletedFiles: number;
}

const jobs = new Map<string, JobRecord>();

/**
 * Ids explicitly cancelled by a caller. `runExcelJob` cooperates by checking
 * this set (and the persisted record) before each long-running step and before
 * publishing a completed file.
 */
const cancelledJobIds = new Set<string>();

function isCancelled(jobId: string): boolean {
  return cancelledJobIds.has(jobId) || jobs.get(jobId)?.status === 'cancelled';
}

function markCancelled(jobId: string, base: JobRecord): void {
  const common = {
    createdAt: base.createdAt,
    organizationPublicKey: base.organizationPublicKey,
    batchId: base.batchId,
    kind: base.kind,
    cancelledAt: Date.now(),
  } as const;

  if (base.kind === 'csv') {
    jobs.set(jobId, {
      ...common,
      status: 'cancelled',
      startDate: base.startDate,
      endDate: base.endDate,
      columns: base.columns,
    });
  } else {
    jobs.set(jobId, { ...common, status: 'cancelled' });
  }
}

async function cleanupJobFile(job: JobRecord): Promise<boolean> {
  if (job.status !== 'completed') return false;
  try {
    await fs.unlink(job.filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retention sweep: removes job records older than `maxAgeMs` and unlinks the
 * generated export file for completed jobs. Exported (and injectable with an
 * explicit clock) so the job can be unit-tested without fake timers.
 */
export async function purgeExpiredJobs(
  now: number = Date.now(),
  maxAgeMs: number = DEFAULT_JOB_MAX_AGE_MS
): Promise<PurgeResult> {
  const result: PurgeResult = { deletedJobs: 0, deletedFiles: 0 };

  for (const [id, job] of jobs) {
    if (now - job.createdAt <= maxAgeMs) continue;

    const fileDeleted = await cleanupJobFile(job);
    jobs.delete(id);
    cancelledJobIds.delete(id);
    result.deletedJobs += 1;
    if (fileDeleted) result.deletedFiles += 1;
  }

  return result;
}

// Periodic retention. Tests call purgeExpiredJobs() directly with an explicit
// clock, so this interval never needs to fire during a unit test.
setInterval(() => {
  void purgeExpiredJobs();
}, RETENTION_INTERVAL_MS).unref();

export const exportJobService = {
  startPayrollExcelJob(organizationPublicKey: string, batchId: string): string {
    void purgeExpiredJobs();
    const id = randomUUID();
    jobs.set(id, {
      status: 'pending',
      createdAt: Date.now(),
      organizationPublicKey,
      batchId,
      kind: 'excel' as const,
    });

    setImmediate(() => {
      void runExcelJob(id, organizationPublicKey, batchId);
    });

    return id;
  },

  startPayrollCsvJob(
    organizationPublicKey: string,
    startDate?: string,
    endDate?: string,
    columns?: CustomReportColumn[]
  ): string {
    void purgeExpiredJobs();
    const id = randomUUID();
    const jobId = `csv-${id}`;
    jobs.set(jobId, {
      status: 'pending' as const,
      createdAt: Date.now(),
      organizationPublicKey,
      batchId: jobId,
      kind: 'csv' as const,
      startDate,
      endDate,
      columns: columns ?? [],
    });

    setImmediate(() => {
      void runCsvJob(jobId, organizationPublicKey, startDate, endDate, columns);
    });

    return jobId;
  },

  getJob(jobId: string): JobRecord | undefined {
    return jobs.get(jobId);
  },

  /**
   * Requests cancellation of a pending/processing job. Completed and failed
   * jobs are terminal and cannot be cancelled.
   */
  cancelJob(jobId: string): CancelResult {
    const job = jobs.get(jobId);
    if (!job) return 'not_found';
    if (job.status !== 'pending' && job.status !== 'processing') return 'not_cancellable';

    cancelledJobIds.add(jobId);
    markCancelled(jobId, job);
    return 'cancelled';
  },

  async takeCompletedFile(jobId: string): Promise<string | null> {
    const job = jobs.get(jobId);
    if (!job || job.status !== 'completed') return null;
    const p = job.filePath;
    jobs.delete(jobId);
    cancelledJobIds.delete(jobId);
    return p;
  },
};

async function runExcelJob(
  jobId: string,
  organizationPublicKey: string,
  batchId: string
): Promise<void> {
  const cur = jobs.get(jobId);
  if (!cur) return;
  // A cancel may have arrived before this deferred job got a chance to start.
  if (isCancelled(jobId)) {
    markCancelled(jobId, cur);
    return;
  }

  jobs.set(jobId, {
    status: 'processing',
    createdAt: cur.createdAt,
    organizationPublicKey,
    batchId,
    kind: 'excel',
  });

  const tmp = path.join(os.tmpdir(), `payd-payroll-${jobId}.xlsx`);

  try {
    const batchData = await payrollQueryService.getPayrollBatch(
      organizationPublicKey,
      batchId,
      1,
      500_000
    );

    if (isCancelled(jobId)) {
      markCancelled(jobId, cur);
      return;
    }

    if (!batchData?.data?.length) {
      jobs.set(jobId, {
        status: 'failed',
        createdAt: cur.createdAt,
        error: 'Batch not found or empty',
        organizationPublicKey,
        batchId,
        kind: 'excel',
      });
      return;
    }

    const writeStream = createWriteStream(tmp);
    await ExportService.generatePayrollExcel(batchId, batchData.data, writeStream);
    await finished(writeStream);

    // Do not publish the file if the job was cancelled while generating.
    if (isCancelled(jobId)) {
      await fs.unlink(tmp).catch(() => {});
      markCancelled(jobId, cur);
      return;
    }

    jobs.set(jobId, {
      status: 'completed',
      createdAt: cur.createdAt,
      filePath: tmp,
      organizationPublicKey,
      batchId,
      kind: 'excel',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `payroll-batch-${batchId}.xlsx`,
    });
  } catch (e) {
    await fs.unlink(tmp).catch(() => {});
    if (isCancelled(jobId)) {
      markCancelled(jobId, cur);
      return;
    }
    jobs.set(jobId, {
      status: 'failed',
      createdAt: cur.createdAt,
      error: (e as Error).message,
      organizationPublicKey,
      batchId,
      kind: 'excel',
    });
  }
}

async function runCsvJob(
  jobId: string,
  organizationPublicKey: string,
  startDate?: string,
  endDate?: string,
  columns?: CustomReportColumn[]
): Promise<void> {
  const cur = jobs.get(jobId);
  if (!cur) return;
  // A cancel may have arrived before this deferred job got a chance to start.
  if (isCancelled(jobId)) {
    markCancelled(jobId, cur);
    return;
  }

  jobs.set(jobId, {
    status: 'processing',
    createdAt: cur.createdAt,
    organizationPublicKey,
    batchId: jobId,
    kind: 'csv',
    startDate,
    endDate,
    columns: columns ?? [],
  });

  const tmp = path.join(os.tmpdir(), `payd-payroll-${jobId}.csv`);

  try {
    const transactions = await fetchAllTransactionsForCsv(
      organizationPublicKey,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    if (isCancelled(jobId)) {
      markCancelled(jobId, cur);
      return;
    }

    const selectedColumns = columns?.length ? columns : getDefaultCsvColumns();
    const rows = transactions.map(normalizePayrollExportRowForCsv);

    const writeStream = createWriteStream(tmp);
    await ExportService.generateCustomCsv(selectedColumns, rows, writeStream);
    await finished(writeStream);

    // Do not publish the file if the job was cancelled while generating.
    if (isCancelled(jobId)) {
      await fs.unlink(tmp).catch(() => {});
      markCancelled(jobId, cur);
      return;
    }

    jobs.set(jobId, {
      status: 'completed',
      createdAt: cur.createdAt,
      filePath: tmp,
      organizationPublicKey,
      batchId: jobId,
      kind: 'csv',
      contentType: 'text/csv',
      filename: `payroll-export-${jobId}.csv`,
    });
  } catch (e) {
    try {
      await fs.unlink(tmp);
    } catch {
      /* ignore */
    }
    if (isCancelled(jobId)) {
      markCancelled(jobId, cur);
      return;
    }
    jobs.set(jobId, {
      status: 'failed',
      createdAt: cur.createdAt,
      error: (e as Error).message,
      organizationPublicKey,
      batchId: jobId,
      kind: 'csv',
    });
  }
}

async function fetchAllTransactionsForCsv(
  organizationPublicKey: string,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  const rows: any[] = [];
  let page = 1;
  const limit = 500;

  while (page <= 100) {
    const result = await payrollQueryService.queryPayroll(
      {
        organizationPublicKey,
        startDate,
        endDate,
        includeFailedPayments: true,
      },
      page,
      limit,
      { enrichPayrollData: true, sortBy: 'timestamp', sortOrder: 'desc' }
    );

    rows.push(...result.data);
    if (!result.hasMore || result.data.length === 0) break;
    page += 1;
  }

  return rows;
}

function normalizePayrollExportRowForCsv(transaction: any): CustomReportRow {
  return {
    txHash: transaction.txHash,
    employeeId: transaction.employeeId || 'N/A',
    payrollBatchId: transaction.payrollBatchId || 'N/A',
    itemType: transaction.itemType === 'bonus' ? 'Bonus' : 'Base Salary',
    amount: transaction.amount || '0',
    assetCode: transaction.assetCode || 'Native',
    assetIssuer: transaction.assetIssuer || '',
    status: transaction.successful ? 'Success' : 'Failed',
    timestamp: new Date(transaction.timestamp * 1000).toISOString(),
    memo: transaction.memo || '',
    sourceAccount: transaction.sourceAccount || '',
    destAccount: transaction.destAccount || '',
    ledgerHeight: transaction.ledgerHeight,
    fee: transaction.fee || '0',
    description: transaction.description || '',
  };
}

function getDefaultCsvColumns(): CustomReportColumn[] {
  return [
    { key: 'txHash', label: 'Transaction Hash', width: 40 },
    { key: 'employeeId', label: 'Employee ID', width: 16 },
    { key: 'payrollBatchId', label: 'Batch ID', width: 18 },
    { key: 'itemType', label: 'Payment Type', width: 14 },
    { key: 'amount', label: 'Amount', width: 14 },
    { key: 'assetCode', label: 'Asset', width: 12 },
    { key: 'status', label: 'Status', width: 12 },
    { key: 'timestamp', label: 'Timestamp', width: 22 },
    { key: 'memo', label: 'Memo', width: 42 },
    { key: 'sourceAccount', label: 'Source Account', width: 38 },
    { key: 'description', label: 'Description', width: 36 },
  ];
}
