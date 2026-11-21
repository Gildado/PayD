import type { NextFunction, Request, Response } from 'express';
import { pool } from '../../config/database.js';
import { require2FA } from '../require2fa.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));

const mockQuery = pool.query as jest.Mock;
const walletUpdate2FA = require2FA({
  when: (req) => Object.prototype.hasOwnProperty.call(req.body ?? {}, 'wallet_address'),
});

describe('require2FA predicate for wallet updates', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('skips verification when the guarded field is absent', async () => {
    await walletUpdate2FA(createReq({ body: { name: 'Alice' } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('runs verification when the wallet field is present', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await walletUpdate2FA(createReq({ body: { wallet_address: 'GABC' } }), res, next);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
