import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import {
  createExportDownloadToken,
  type ExportTokenPayload,
} from '../../utils/exportDownloadToken.js';

const mockPoolQuery = jest.fn();
const mockGetTransactionDetails = jest.fn();

jest.unstable_mockModule('pg', () => ({
  Pool: class {
    query = (...args: unknown[]) => mockPoolQuery(...args);
    on = jest.fn();
    end = jest.fn();
  },
}));

jest.unstable_mockModule('../../services/payroll-query.service.js', () => ({
  payrollQueryService: {
    getTransactionDetails: (...args: unknown[]) => mockGetTransactionDetails(...args),
  },
}));

const { clearConsumedDownloadTokens, exportDownloadAuth } = await import(
  '../exportDownloadAuth.js'
);

const authHeader = (userId: number) =>
  `Bearer ${jwt.sign({ id: userId, organizationId: 1, role: 'EMPLOYER' }, config.JWT_SECRET)}`;

const futureExp = () => Math.floor(Date.now() / 1000) + 600;

const app = express();
app.get('/receipt/:txHash/pdf', exportDownloadAuth('receipt'), (_req, res) => {
  res.status(200).json({ ok: true });
});
app.get(
  '/payroll/:organizationPublicKey/:batchId/excel',
  exportDownloadAuth('payroll'),
  (_req, res) => {
    res.status(200).json({ ok: true });
  }
);

beforeEach(() => {
  jest.resetAllMocks();
  clearConsumedDownloadTokens();
  mockPoolQuery.mockResolvedValue({ rows: [{ public_key: 'ORG_PK' }] });
});

describe('signed download token authorization', () => {
  test('accepts a valid, user-bound token for the matching receipt', async () => {
    const token = createExportDownloadToken({
      kind: 'receipt',
      txHash: 'tx-1',
      exp: futureExp(),
      userId: 7,
    });

    await request(app)
      .get('/receipt/tx-1/pdf')
      .set('Authorization', authHeader(7))
      .query({ token })
      .expect(200);
  });

  test('rejects a token issued to a different user', async () => {
    const token = createExportDownloadToken({
      kind: 'receipt',
      txHash: 'tx-1',
      exp: futureExp(),
      userId: 7,
    });

    await request(app)
      .get('/receipt/tx-1/pdf')
      .set('Authorization', authHeader(8))
      .query({ token })
      .expect(403);
  });

  test('rejects an expired token', async () => {
    const token = createExportDownloadToken({
      kind: 'receipt',
      txHash: 'tx-1',
      exp: Math.floor(Date.now() / 1000) - 10,
      userId: 7,
    });

    await request(app)
      .get('/receipt/tx-1/pdf')
      .set('Authorization', authHeader(7))
      .query({ token })
      .expect(401);
  });

  test('rejects a reused (single-use) token on the second request', async () => {
    const token = createExportDownloadToken({
      kind: 'receipt',
      txHash: 'tx-1',
      exp: futureExp(),
      userId: 7,
    });

    const first = await request(app)
      .get('/receipt/tx-1/pdf')
      .set('Authorization', authHeader(7))
      .query({ token });
    expect(first.status).toBe(200);

    const second = await request(app)
      .get('/receipt/tx-1/pdf')
      .set('Authorization', authHeader(7))
      .query({ token });
    expect(second.status).toBe(401);
    expect(second.body.error).toMatch(/already been used/i);
  });

  test('a resource mismatch is rejected and does not consume the token', async () => {
    const payload: ExportTokenPayload = {
      kind: 'payroll',
      organizationPublicKey: 'ORG_PK',
      batchId: 'batch-1',
      exp: futureExp(),
      userId: 7,
    };
    const token = createExportDownloadToken(payload);

    await request(app)
      .get('/payroll/ORG_PK/wrong-batch/excel')
      .set('Authorization', authHeader(7))
      .query({ token })
      .expect(403);

    await request(app)
      .get('/payroll/ORG_PK/batch-1/excel')
      .set('Authorization', authHeader(7))
      .query({ token })
      .expect(200);
  });
});

describe('session-based fallback', () => {
  test('denies a user from another organization', async () => {
    await request(app)
      .get('/payroll/OTHER_ORG/batch-1/excel')
      .set('Authorization', authHeader(7))
      .expect(403);
  });

  test('denies receipt access when the transaction is not owned by the user org', async () => {
    mockGetTransactionDetails.mockResolvedValue({ sourceAccount: 'SOMEONE_ELSE' });

    await request(app)
      .get('/receipt/tx-1/pdf')
      .set('Authorization', authHeader(7))
      .expect(403);
  });

  test('allows session access to an owned receipt', async () => {
    mockGetTransactionDetails.mockResolvedValue({ sourceAccount: 'ORG_PK' });

    await request(app)
      .get('/receipt/tx-1/pdf')
      .set('Authorization', authHeader(7))
      .expect(200);
  });
});
