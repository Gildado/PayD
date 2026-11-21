import { NextFunction, Request, Response } from 'express';
import { authenticator } from 'otplib';
import { pool } from '../../config/database.js';
import { require2FA } from '../require2fa.js';
const require2FAForAdmin = require2FA({ requireEnabled: true, identity: 'userId' });
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('otplib', () => ({ authenticator: { check: jest.fn() } }));

const mockQuery = pool.query as jest.Mock;
const mockCheck = authenticator.check as jest.Mock;
const authenticatedUser = { id: 1, organizationId: 7, role: 'EMPLOYER' as const };
const userWith2fa = {
  is_2fa_enabled: true,
  totp_secret: 'SECRET',
  recovery_codes: ['CODE-A', 'code-b'],
};

describe('require2FAForAdmin', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('returns 401 when there is no authenticated user', async () => {
    await require2FAForAdmin(createReq({}), res, next);

    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the admin has not enabled 2FA', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ is_2fa_enabled: false, totp_secret: null, recovery_codes: null }],
    });
    const req = createReq({ user: authenticatedUser, headers: { 'x-2fa-token': '123456' } });

    await require2FAForAdmin(req, res, next);

    expect(res._status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid single-use recovery code and consumes it', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userWith2fa] })
      .mockResolvedValueOnce({ rows: [] });
    const req = createReq({
      user: authenticatedUser,
      headers: { 'x-2fa-token': 'CODE-B' },
    });

    await require2FAForAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE users SET recovery_codes'),
      [['CODE-A'], 1]
    );
  });

  it('accepts a valid TOTP token (success path)', async () => {
    mockQuery.mockResolvedValue({ rows: [userWith2fa] });
    mockCheck.mockReturnValue(true);
    const req = createReq({ user: authenticatedUser, headers: { 'x-2fa-token': '123456' } });

    await require2FAForAdmin(req, res, next);

    expect(mockCheck).toHaveBeenCalledWith('123456', 'SECRET');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid 2FA token (failure path)', async () => {
    mockQuery.mockResolvedValue({ rows: [userWith2fa] });
    mockCheck.mockReturnValue(false);
    const req = createReq({ user: authenticatedUser, headers: { 'x-2fa-token': '000000' } });

    await require2FAForAdmin(req, res, next);

    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when the database query fails', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    const req = createReq({ user: authenticatedUser, headers: { 'x-2fa-token': '123456' } });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await require2FAForAdmin(req, res, next);

    expect(res._status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
