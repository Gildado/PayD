import { jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
const mockGetBatch = jest.fn();
const mockGenerate = jest.fn();

jest.unstable_mockModule('../payroll-query.service.js', () => ({
  payrollQueryService: {
    getPayrollBatch: (...args: unknown[]) => mockGetBatch(...args),
  },
}));

jest.unstable_mockModule('../exportService.js', () => ({
  ExportService: {
    generatePayrollExcel: (...args: unknown[]) => mockGenerate(...args),
  },
}));

const {
  DEFAULT_JOB_MAX_AGE_MS,
  exportJobService,
  purgeExpiredJobs,
} = await import('../exportJobService.js');

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const waitForStatus = async (
  jobId: string,
  status: string,
  timeoutMs = 2000
): Promise<void> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (exportJobService.getJob(jobId)?.status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Job ${jobId} never reached status ${status}`);
};

beforeEach(() => {
  jest.resetAllMocks();
  mockGetBatch.mockResolvedValue({ data: [{ id: 'tx-1' }], total: 1 });
  mockGenerate.mockImplementation(
    async (_batchId: string, _rows: unknown[], stream: NodeJS.WritableStream) => {
      stream.write(Buffer.from('PK-test-export'));
      stream.end();
    }
  );
});

describe('export job cancellation', () => {
  test('cancel stops a pending job before it touches the data source', async () => {
    const id = exportJobService.startPayrollExcelJob('org-pk', 'batch-1');

    expect(exportJobService.cancelJob(id)).toBe('cancelled');
    expect(exportJobService.getJob(id)?.status).toBe('cancelled');

    await flush();
    await flush();
    await flush();
    expect(mockGetBatch).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test('cancel during processing prevents a completed file from being published', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockGenerate.mockImplementation(
      async (_batchId: string, _rows: unknown[], stream: NodeJS.WritableStream) => {
        await gate;
        stream.write(Buffer.from('PK-in-flight'));
        stream.end();
      }
    );

    const id = exportJobService.startPayrollExcelJob('org-pk', 'batch-2');
    await waitForStatus(id, 'processing');

    expect(exportJobService.cancelJob(id)).toBe('cancelled');
    release();
    await waitForStatus(id, 'cancelled');

    // The record flips to 'cancelled' synchronously; the in-flight generator
    // still needs a tick to unlink its temporary file.
    const tmp = path.join(os.tmpdir(), `payd-payroll-${id}.xlsx`);
    const cleanupDeadline = Date.now() + 2000;
    while (Date.now() < cleanupDeadline) {
      try {
        await fs.access(tmp);
      } catch {
        return;
      }
      await flush();
    }
    throw new Error(`Temporary file ${tmp} was not cleaned up after cancellation`);
  });

  test('completed and failed jobs are terminal, unknown jobs are not found', async () => {
    expect(exportJobService.cancelJob('does-not-exist')).toBe('not_found');

    const completedId = exportJobService.startPayrollExcelJob('org-pk', 'batch-3');
    await waitForStatus(completedId, 'completed');
    expect(exportJobService.cancelJob(completedId)).toBe('not_cancellable');

    mockGetBatch.mockResolvedValueOnce(null);
    const failedId = exportJobService.startPayrollExcelJob('org-pk', 'batch-4');
    await waitForStatus(failedId, 'failed');
    expect(exportJobService.cancelJob(failedId)).toBe('not_cancellable');
  });
});

describe('export retention job', () => {
  test('purge deletes expired job records and unlinks their export files', async () => {
    const id = exportJobService.startPayrollExcelJob('org-pk', 'batch-retention');
    await waitForStatus(id, 'completed');

    const completed = exportJobService.getJob(id);
    expect(completed?.status).toBe('completed');
    if (!completed || completed.status !== 'completed') throw new Error('job did not complete');
    await expect(fs.access(completed.filePath)).resolves.toBeUndefined();

    const result = await purgeExpiredJobs(Date.now() + DEFAULT_JOB_MAX_AGE_MS + 1);

    expect(result.deletedJobs).toBeGreaterThanOrEqual(1);
    expect(result.deletedFiles).toBeGreaterThanOrEqual(1);
    expect(exportJobService.getJob(id)).toBeUndefined();
    await expect(fs.access(completed.filePath)).rejects.toThrow();
  });

  test('purge keeps jobs that are still within the retention window', async () => {
    const id = exportJobService.startPayrollExcelJob('org-pk', 'batch-fresh');
    await waitForStatus(id, 'completed');

    const result = await purgeExpiredJobs(Date.now(), DEFAULT_JOB_MAX_AGE_MS);

    expect(result.deletedJobs).toBe(0);
    expect(exportJobService.getJob(id)).toBeDefined();
  });
});
