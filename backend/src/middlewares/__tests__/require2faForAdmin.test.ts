import { Request, Response, NextFunction } from 'express';

// ── Database mock ─────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../../config/database.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

// ── otplib mock ───────────────────────────────────────────────────────────────
const mockCheck = jest.fn();
jest.mock('otplib', () => ({
  authenticator: { check: (...args: unknown[]) => mockCheck(...args) },
}));

import { require2FAForAdmin } from '../require2faForAdmin.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 1, organizationId: 42, role: 'EMPLOYER', email: 'admin@acme.com' },
    headers: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

describe('require2FAForAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when no authenticated user is present', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await require2FAForAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the admin has not enabled 2FA', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_2fa_enabled: false, totp_secret: null, recovery_codes: null }],
    });
    const req = mockReq({ headers: { 'x-2fa-token': '123456' } });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await require2FAForAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when 2FA is enabled but no token is supplied', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_2fa_enabled: true, totp_secret: 'SECRET', recovery_codes: [] }],
    });
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await require2FAForAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a valid TOTP token', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_2fa_enabled: true, totp_secret: 'SECRET', recovery_codes: [] }],
    });
    mockCheck.mockReturnValue(true);
    const req = mockReq({ headers: { 'x-2fa-token': '123456' } });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await require2FAForAdmin(req, res, next);

    expect(mockCheck).toHaveBeenCalledWith('123456', 'SECRET');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid TOTP token', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_2fa_enabled: true, totp_secret: 'SECRET', recovery_codes: [] }],
    });
    mockCheck.mockReturnValue(false);
    const req = mockReq({ body: { twoFactorToken: '000000' } });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await require2FAForAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a recovery code and consumes it (single-use)', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ is_2fa_enabled: true, totp_secret: 'SECRET', recovery_codes: ['ABC123', 'XYZ789'] }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE consuming the code
    const req = mockReq({ headers: { 'x-2fa-token': 'abc123' } });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await require2FAForAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    // The consumed code is removed, leaving only the unused one.
    expect(mockQuery).toHaveBeenLastCalledWith(
      'UPDATE users SET recovery_codes = $1 WHERE id = $2',
      [['XYZ789'], 1]
    );
    // TOTP check should not run when a recovery code matched.
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it('returns 500 when the database lookup fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const req = mockReq({ headers: { 'x-2fa-token': '123456' } });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await require2FAForAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
