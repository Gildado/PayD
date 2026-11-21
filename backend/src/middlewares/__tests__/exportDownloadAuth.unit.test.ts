import { NextFunction, Request, Response } from 'express';
import { verifyExportDownloadToken } from '../../utils/exportDownloadToken.js';
import { payrollQueryService } from '../../services/payroll-query.service.js';
import { exportDownloadAuth } from '../exportDownloadAuth.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../config/env', () => ({ config: { DATABASE_URL: 'postgres://test' } }));
jest.mock('pg', () => {
  const query = jest.fn();
  const Pool = jest.fn(() => ({ query }));
  return { __esModule: true, Pool, query, default: { Pool } };
});
jest.mock('../auth', () => ({
  authenticateJWT: jest.fn((_req: unknown, _res: unknown, cb: () => void) => cb()),
}));
jest.mock('../../utils/exportDownloadToken', () => ({
  verifyExportDownloadToken: jest.fn(),
}));
jest.mock('../../services/payroll-query.service', () => ({
  payrollQueryService: { getTransactionDetails: jest.fn() },
}));

const mockQuery = (jest.requireMock('pg') as { query: jest.Mock }).query;
const mockVerify = verifyExportDownloadToken as jest.Mock;
const mockGetTx = payrollQueryService.getTransactionDetails as jest.Mock;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('exportDownloadAuth', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
    mockQuery.mockResolvedValue({ rows: [{ public_key: 'GORG' }] });
  });

  it('returns 401 for an invalid or expired token (failure path)', async () => {
    mockVerify.mockReturnValue(null);

    await exportDownloadAuth('receipt')(
      createReq({ query: { token: 'bad' }, params: { txHash: 'TX1' } }),
      res,
      next
    );

    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for a valid receipt token that matches the resource (success path)', async () => {
    mockVerify.mockReturnValue({ kind: 'receipt', txHash: 'TX1' });

    await exportDownloadAuth('receipt')(
      createReq({ query: { token: 'tok' }, params: { txHash: 'TX1' } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('returns 403 when a valid token does not match the resource', async () => {
    mockVerify.mockReturnValue({ kind: 'receipt', txHash: 'OTHER' });

    await exportDownloadAuth('receipt')(
      createReq({ query: { token: 'tok' }, params: { txHash: 'TX1' } }),
      res,
      next
    );

    expect(res._status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for a JWT user with no organization', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await exportDownloadAuth('receipt')(
      createReq({ user: { id: 1, organizationId: null, role: 'EMPLOYER' }, params: { txHash: 'TX1' } }),
      res,
      next
    );
    await flush();

    expect(res._status).toHaveBeenCalledWith(403);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Organization not found for user' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a JWT user who owns the transaction receipt', async () => {
    mockGetTx.mockResolvedValue({ sourceAccount: 'GORG' });

    await exportDownloadAuth('receipt')(
      createReq({ user: { id: 1, organizationId: 7, role: 'EMPLOYER' }, params: { txHash: 'TX1' } }),
      res,
      next
    );
    await flush();

    expect(mockGetTx).toHaveBeenCalledWith('TX1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks a payroll export for another organization', async () => {
    await exportDownloadAuth('payroll')(
      createReq({
        user: { id: 1, organizationId: 7, role: 'EMPLOYER' },
        params: { organizationPublicKey: 'SOMEONE-ELSE', batchId: 'B1' },
      }),
      res,
      next
    );
    await flush();

    expect(res._status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
