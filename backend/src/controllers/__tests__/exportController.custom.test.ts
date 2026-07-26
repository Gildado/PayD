import request from 'supertest';
import express from 'express';

jest.mock('pg', () => {
  const mPool = { query: jest.fn(), connect: jest.fn() };
  return { default: { Pool: jest.fn(() => mPool) }, Pool: jest.fn(() => mPool) };
});

jest.mock('../../config/env', () => ({
  config: { DATABASE_URL: 'postgres://mock' },
  getPoolConfig: () => ({
    min: 0,
    max: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
    statementTimeout: 1000,
    queryTimeout: 1000,
  }),
}));

jest.mock('../../config/database.js', () => ({
  pool: { query: jest.fn(), on: jest.fn() },
  query: jest.fn(),
  default: { query: jest.fn(), on: jest.fn() },
}));

jest.mock('../../middlewares/auth.js', () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
}));

jest.mock('../../services/payroll-query.service.js', () => ({
  payrollQueryService: { queryPayroll: jest.fn() },
}));

jest.mock('../../services/exportService.js', () => ({
  ExportService: {
    generateCustomCsv: jest.fn().mockImplementation(async (_columns, _rows, stream) => {
      stream.end('mock-csv');
    }),
    generateCustomExcel: jest.fn(),
    generateCustomPdf: jest.fn(),
  },
}));

import exportRoutes from '../../routes/exportRoutes.js';
import { payrollQueryService } from '../../services/payroll-query.service.js';
import { Pool } from 'pg';

const mockedQueryPayroll = payrollQueryService.queryPayroll as jest.Mock;
const mockedPool = new (Pool as unknown as jest.Mock)();

const app = express();
app.use(express.json());
app.use('/api/v1/exports', exportRoutes);

const ORG_PK = 'GORGPUBLICKEY0000000000000000000000000000000000000000';

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    txHash: 'tx-1',
    sourceAccount: ORG_PK,
    destAccount: 'GDEST',
    amount: '100',
    assetCode: 'USDC',
    operationType: 'payment',
    timestamp: 1700000000,
    ledgerHeight: 100,
    successful: true,
    fee: '100',
    signatures: [],
    ...overrides,
  };
}

describe('ExportController.getCustomPayrollExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPool.query.mockResolvedValue({ rows: [{ public_key: ORG_PK }] });
  });

  const basePayload = {
    organizationPublicKey: ORG_PK,
    format: 'csv',
    columns: ['txHash', 'amount'],
  };

  it('rejects an export whose matching rows exceed the 10,000-row cap', async () => {
    // Two pages of 500 rows each (hasMore stays true) is enough to cross the cap
    // once fetchAllPayrollTransactions' early-exit check kicks in after page 1.
    mockedQueryPayroll.mockImplementation(async (_query: unknown, page: number) => {
      const data = Array.from({ length: 500 }, (_, i) => makeTransaction({ txHash: `tx-${page}-${i}` }));
      return { data, page, limit: 500, total: 20_000, hasMore: true, pageCount: 40 };
    });

    // Force enough pages to exceed 10,000 rows before the loop's own 100-page ceiling.
    const response = await request(app).post('/api/v1/exports/payroll/custom').send(basePayload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/10,000-row limit/);
  }, 15000);

  it('accepts an export within the row cap and streams a CSV', async () => {
    mockedQueryPayroll.mockResolvedValueOnce({
      data: [makeTransaction()],
      page: 1,
      limit: 500,
      total: 1,
      hasMore: false,
      pageCount: 1,
    });

    const response = await request(app).post('/api/v1/exports/payroll/custom').send(basePayload);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toMatch(/payroll-custom-.*\.csv/);
  });

  it('uses a sanitized reportName in the filename and PDF/Excel title when provided', async () => {
    mockedQueryPayroll.mockResolvedValueOnce({
      data: [makeTransaction()],
      page: 1,
      limit: 500,
      total: 1,
      hasMore: false,
      pageCount: 1,
    });

    const response = await request(app)
      .post('/api/v1/exports/payroll/custom')
      .send({ ...basePayload, reportName: 'Q1 Payroll Review!! ' });

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toMatch(/Q1-Payroll-Review-.*\.csv/);
  });

  it('rejects requests missing organizationPublicKey', async () => {
    const response = await request(app)
      .post('/api/v1/exports/payroll/custom')
      .send({ format: 'csv', columns: ['txHash'] });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/organizationPublicKey/);
  });

  it('rejects an unsupported format', async () => {
    const response = await request(app)
      .post('/api/v1/exports/payroll/custom')
      .send({ ...basePayload, format: 'json' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/format must be/);
  });

  it("forbids exporting another organization's data", async () => {
    mockedPool.query.mockResolvedValueOnce({ rows: [{ public_key: 'GDIFFERENTORG' }] });

    const response = await request(app).post('/api/v1/exports/payroll/custom').send(basePayload);

    expect(response.status).toBe(403);
  });
});
