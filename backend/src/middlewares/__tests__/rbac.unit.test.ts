import { NextFunction, Request, Response } from 'express';
import { pool } from '../../config/database.js';
import { authorizeRoles, isolateOrganization } from '../rbac.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

describe('authorizeRoles', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('allows a user whose role is in the allowed list', () => {
    const req = createReq({ user: { id: 1, role: 'EMPLOYER', organizationId: 5 } });

    authorizeRoles('EMPLOYER', 'EMPLOYEE')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).not.toHaveBeenCalled();
  });

  it('returns 401 when no user is authenticated', () => {
    const req = createReq({});

    authorizeRoles('EMPLOYER')(req, res, next);

    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user role is not allowed', () => {
    const req = createReq({ user: { id: 1, role: 'EMPLOYEE', organizationId: 5 } });

    authorizeRoles('EMPLOYER')(req, res, next);

    expect(res._status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('isolateOrganization', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('scopes the request to the user organization and calls next', async () => {
    const req = createReq({ user: { id: 1, role: 'EMPLOYER', organizationId: 5 } });

    await isolateOrganization(req, res, next);

    expect((req as Request & { organizationId?: number }).organizationId).toBe(5);
    expect((req as Request & { tenantId?: number }).tenantId).toBe(5);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when the requested organization does not match', async () => {
    const req = createReq({
      user: { id: 1, role: 'EMPLOYER', organizationId: 5 },
      params: { orgId: '99' },
    });

    await isolateOrganization(req, res, next);

    expect(res._status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when the public-key lookup throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const req = createReq({
      user: { id: 1, role: 'EMPLOYER', organizationId: 5 },
      body: { orgPublicKey: 'GKEY' },
    });

    await isolateOrganization(req, res, next);

    expect(res._status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
