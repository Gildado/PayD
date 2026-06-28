import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { ExportService } from './exportService.js';
import { payrollQueryService } from './payroll-query.service.js';

type JobRecord =
  | { status: 'pending'; createdAt: number; organizationPublicKey: string; batchId: string }
  | { status: 'processing'; createdAt: number; organizationPublicKey: string; batchId: string }
  | {
      status: 'completed';
      createdAt: number;
      filePath: string;
      organizationPublicKey: string;
      batchId: string;
    }
  | {
      status: 'failed';
      createdAt: number;
      error: string;
      organizationPublicKey: string;
      batchId: string;
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
    });

    setImmediate(() => {
      void runExcelJob(id, organizationPublicKey, batchId);
    });

    return id;
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
    });
  }
}
