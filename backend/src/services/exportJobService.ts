import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { ExportService } from './exportService.js';
import { payrollQueryService } from './payroll-query.service.js';

export const DEFAULT_JOB_MAX_AGE_MS = 60 * 60 * 1000;
const RETENTION_INTERVAL_MS = 5 * 60 * 1000;

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface JobBase {
  createdAt: number;
  organizationPublicKey: string;
  batchId: string;
}

export type JobRecord =
  | (JobBase & { status: 'pending' })
  | (JobBase & { status: 'processing' })
  | (JobBase & { status: 'completed'; filePath: string })
  | (JobBase & { status: 'failed'; error: string })
  | (JobBase & { status: 'cancelled'; cancelledAt: number });

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

function markCancelled(jobId: string, base: JobBase): void {
  jobs.set(jobId, {
    ...base,
    status: 'cancelled',
    cancelledAt: Date.now(),
  });
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
    });

    setImmediate(() => {
      void runExcelJob(id, organizationPublicKey, batchId);
    });

    return id;
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
    });
  }
}
