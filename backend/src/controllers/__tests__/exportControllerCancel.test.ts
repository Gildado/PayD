import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockPoolQuery = jest.fn();
const mockGetJob = jest.fn();
const mockCancelJob = jest.fn();

jest.unstable_mockModule('pg', () => ({
  Pool: class {
    query = (...args: unknown[]) => mockPoolQuery(...args);
    on = jest.fn();
    end = jest.fn();
  },
}));

jest.unstable_mockModule('../../services/exportJobService.js', () => ({
  exportJobService: {
    getJob: (...args: unknown[]) => mockGetJob(...args),
    cancelJob: (...args: unknown[]) => mockCancelJob(...args),
    startPayrollExcelJob: jest.fn(),
    takeCompletedFile: jest.fn(),
  },
}));

const { ExportController } = await import('../exportController.js');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
  next();
});
app.post('/jobs/:jobId/cancel', ExportController.cancelPayrollExportJob);

beforeEach(() => {
  jest.resetAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [{ public_key: 'ORG_PK' }] });
});

describe('POST payroll export job cancel', () => {
  test('returns 404 for an unknown job', async () => {
    mockGetJob.mockReturnValue(undefined);
    await request(app).post('/jobs/missing/cancel').expect(404);
    expect(mockCancelJob).not.toHaveBeenCalled();
  });

  test('denies cancellation of another organization job', async () => {
    mockGetJob.mockReturnValue({
      status: 'processing',
      organizationPublicKey: 'OTHER_ORG',
      batchId: 'b1',
      createdAt: Date.now(),
    });
    await request(app).post('/jobs/job-1/cancel').expect(403);
    expect(mockCancelJob).not.toHaveBeenCalled();
  });

  test('returns 409 for a completed job', async () => {
    mockGetJob.mockReturnValue({
      status: 'completed',
      organizationPublicKey: 'ORG_PK',
      batchId: 'b1',
      createdAt: Date.now(),
      filePath: '/tmp/payd-payroll-job-1.xlsx',
    });
    const res = await request(app).post('/jobs/job-1/cancel').expect(409);
    expect(res.body.status).toBe('completed');
    expect(mockCancelJob).not.toHaveBeenCalled();
  });

  test('cancels a pending job belonging to the user organization', async () => {
    mockGetJob.mockReturnValue({
      status: 'pending',
      organizationPublicKey: 'ORG_PK',
      batchId: 'b1',
      createdAt: Date.now(),
    });
    mockCancelJob.mockReturnValue('cancelled');

    const res = await request(app).post('/jobs/job-1/cancel').expect(200);
    expect(res.body).toEqual({ jobId: 'job-1', status: 'cancelled' });
    expect(mockCancelJob).toHaveBeenCalledWith('job-1');
  });
});
