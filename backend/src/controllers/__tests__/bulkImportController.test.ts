import request from 'supertest';
import express from 'express';

jest.mock('../../config/database.js', () => ({
  __esModule: true,
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    PORT: 3000,
  },
}));

jest.mock('../../middlewares/auth.js', () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = { id: 1, organizationId: 1, role: 'EMPLOYER' };
    next();
  },
}));

jest.mock('../../middlewares/rbac.js', () => ({
  __esModule: true,
  authorizeRoles: () => (_req: any, _res: any, next: any) => next(),
  isolateOrganization: (_req: any, _res: any, next: any) => next(),
}));

import employeeRoutes from '../../routes/employeeRoutes.js';
import { csvPayrollImportService } from '../../services/csvPayrollImportService.js';
import { MAX_BULK_IMPORT_CSV_BYTES, MAX_BULK_IMPORT_REQUEST_BYTES } from '../../schemas/bulkImportSchema.js';

jest.mock('../../services/csvPayrollImportService.js', () => ({
  csvPayrollImportService: {
    processCsv: jest.fn(),
  },
  UnsupportedCsvEncodingError: class UnsupportedCsvEncodingError extends Error {
    constructor() {
      super('Unsupported CSV encoding: only UTF-8 encoded files are supported.');
      this.name = 'UnsupportedCsvEncodingError';
    }
  },
}));

// The test app no longer needs a global regex-based JSON parser override:
// the route-level express.json({ limit }) middleware in employeeRoutes.ts
// is the single authoritative enforcement point.
const app = express();
app.use('/api/employees', employeeRoutes);

describe('BulkImportController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('middleware-level body size enforcement', () => {
    it('rejects a raw request body that exceeds MAX_BULK_IMPORT_REQUEST_BYTES with 413 before reaching the controller', async () => {
      // Build a JSON body whose serialised length exceeds the middleware cap.
      // The entire JSON envelope ("{"csv":"<data>"}) must exceed the limit, so
      // we account for the envelope overhead in the repeated content.
      const envelopeOverhead = '{"csv":""}' .length;
      const csvData = 'a'.repeat(MAX_BULK_IMPORT_REQUEST_BYTES - envelopeOverhead + 1);
      const rawBody = JSON.stringify({ csv: csvData });

      expect(Buffer.byteLength(rawBody, 'utf8')).toBeGreaterThan(MAX_BULK_IMPORT_REQUEST_BYTES);

      const response = await request(app)
        .post('/api/employees/bulk-import')
        .set('Content-Type', 'application/json')
        .send(rawBody)
        .expect(413);

      // Express itself returns the 413 before the controller runs, so
      // processCsv must never be called.
      expect(csvPayrollImportService.processCsv).not.toHaveBeenCalled();
      // Express emits a plain-text "request entity too large" body; the
      // response may or may not be JSON, so we only assert the status code.
      expect(response.status).toBe(413);
    });
  });

  describe('controller-level CSV content size enforcement', () => {
    it('rejects CSV content that exceeds MAX_BULK_IMPORT_CSV_BYTES with 413 and PAYLOAD_TOO_LARGE code', async () => {
      // This payload fits within the JSON body limit but the csv string itself
      // is over the content limit, so the controller's isCsvContentOversized
      // check fires.
      const oversizedCsv = 'a'.repeat(MAX_BULK_IMPORT_CSV_BYTES + 1);

      const response = await request(app)
        .post('/api/employees/bulk-import')
        .send({ csv: oversizedCsv })
        .expect(413);

      expect(response.body).toHaveProperty('code', 'PAYLOAD_TOO_LARGE');
      expect(response.body.message).toContain(String(MAX_BULK_IMPORT_CSV_BYTES));
      expect(csvPayrollImportService.processCsv).not.toHaveBeenCalled();
    });
  });

  it('accepts CSV within the size limit', async () => {
    const csvContent =
      'first_name,last_name,email\nJohn,Doe,john@example.com';
    (csvPayrollImportService.processCsv as jest.Mock).mockResolvedValue({
      totalRows: 1,
      successCount: 1,
      errorCount: 0,
      errors: [],
    });

    await request(app)
      .post('/api/employees/bulk-import')
      .send({ csv: csvContent })
      .expect(201);

    expect(csvPayrollImportService.processCsv).toHaveBeenCalledWith(1, csvContent);
  });
});
