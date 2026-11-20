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

type JobRecord =
  | {
      status: 'pending';
      createdAt: number;
      organizationPublicKey: string;
      batchId: string;
      kind: 'excel';
    }
  | {
      status: 'processing';
      createdAt: number;
      organizationPublicKey: string;
      batchId: string;
      kind: 'excel';
    }
  | {
      status: 'completed';
      createdAt: number;
      filePath: string;
      organizationPublicKey: string;
      batchId: string;
      kind: 'excel';
      contentType?: string;
      filename?: string;
    }
  | {
      status: 'failed';
      createdAt: number;
      error: string;
      organizationPublicKey: string;
      batchId: string;
      kind: 'excel' | 'csv';
    }
  | {
      status: 'pending';
      createdAt: number;
      organizationPublicKey: string;
      batchId: string;
      kind: 'csv';
      startDate?: string;
      endDate?: string;
      columns: CustomReportColumn[];
    }
  | {
      status: 'processing';
      createdAt: number;
      organizationPublicKey: string;
      batchId: string;
      kind: 'csv';
      startDate?: string;
      endDate?: string;
      columns: CustomReportColumn[];
    }
  | {
      status: 'completed';
      createdAt: number;
      filePath: string;
      organizationPublicKey: string;
      batchId: string;
      kind: 'csv';
      contentType?: string;
      filename?: string;
    };

const jobs = new Map<string, JobRecord>();
const MAX_AGE_MS = 60 * 60 * 1000;

function prune(): void {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.createdAt > MAX_AGE_MS) {
      void cleanupJobFile(j).finally(() => jobs.delete(id));
    }
  }
}

async function cleanupJobFile(j: JobRecord): Promise<void> {
  if (j.status === 'completed') {
    try {
      await fs.unlink(j.filePath);
    } catch {
      /* ignore */
    }
  }
}

setInterval(prune, 5 * 60 * 1000).unref();

export const exportJobService = {
  startPayrollExcelJob(organizationPublicKey: string, batchId: string): string {
    prune();
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
    prune();
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

  async takeCompletedFile(jobId: string): Promise<string | null> {
    const j = jobs.get(jobId);
    if (!j || j.status !== 'completed') return null;
    const p = j.filePath;
    jobs.delete(jobId);
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
    try {
      await fs.unlink(tmp);
    } catch {
      /* ignore */
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

    const selectedColumns = columns?.length ? columns : getDefaultCsvColumns();
    const rows = transactions.map(normalizePayrollExportRowForCsv);

    const writeStream = createWriteStream(tmp);
    await ExportService.generateCustomCsv(selectedColumns, rows, writeStream);
    await finished(writeStream);

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
