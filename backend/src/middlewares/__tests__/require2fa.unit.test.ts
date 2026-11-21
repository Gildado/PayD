import { NextFunction, Request, Response } from 'express';
import { authenticator } from 'otplib';
import { pool } from '../../config/database.js';
import { require2FA } from '../require2fa.js';
const walletTwoFactor = require2FA();
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('otplib', () => ({ authenticator: { check: jest.fn() } }));

const mockQuery = pool.query as jest.Mock;
const mockCheck = authenticator.check as jest.Mock;
const userWith2fa = {
  is_2fa_enabled: true,
  totp_secret: 'SECRET',
  recovery_codes: ['RC-1'],
};
const walletReq = (overrides: Record<string, unknown> = {}) =>
  createReq({
    body: { walletAddress: 'GABC', senderPublicKey: 'GABC' },
    headers: {},
    ...overrides,
  });

describe('require2FA', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('returns 400 when no wallet address can be determined', async () => {
    await walletTwoFactor(createReq({ body: {}, headers: {} }), res, next);

    expect(res._status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when the wallet has no 2FA enabled', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await walletTwoFactor(walletReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('accepts a valid recovery code and consumes it', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userWith2fa] })
      .mockResolvedValueOnce({ rows: [] });
    const req = walletReq({ headers: { 'x-2fa-token': 'rc-1' } });

    await walletTwoFactor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE users SET recovery_codes'),
      [[], 'GABC']
    );
  });

  it('calls next for a valid TOTP token', async () => {
    mockQuery.mockResolvedValue({ rows: [userWith2fa] });
    mockCheck.mockReturnValue(true);
    const req = walletReq({ headers: { 'x-2fa-token': '123456' } });

    await walletTwoFactor(req, res, next);

    expect(mockCheck).toHaveBeenCalledWith('123456', 'SECRET');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 for an invalid token (failure path)', async () => {
    mockQuery.mockResolvedValue({ rows: [userWith2fa] });
    mockCheck.mockReturnValue(false);
    const req = walletReq({ headers: { 'x-2fa-token': '000000' } });

    await walletTwoFactor(req, res, next);

    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when the database throws', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));

    await walletTwoFactor(walletReq({ headers: { 'x-2fa-token': '123456' } }), res, next);

    expect(res._status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
