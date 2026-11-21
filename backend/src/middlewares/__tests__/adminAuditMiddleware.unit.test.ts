import { NextFunction, Request, Response } from 'express';
import { adminAuditService } from '../../services/adminAuditService.js';
import { auditAction } from '../adminAuditMiddleware.js';
import { createNext, createReq, createRes } from './mockExpress';

jest.mock('../../services/adminAuditService', () => ({
  adminAuditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

const mockLog = adminAuditService.log as jest.Mock;

describe('auditAction', () => {
  let next: jest.Mock & NextFunction;
  let res: ReturnType<typeof createRes>;

  beforeEach(() => {
    mockLog.mockClear();
    mockLog.mockResolvedValue(undefined);
    next = createNext() as jest.Mock & NextFunction;
    res = createRes();
  });

  it('logs a successful mutating request and calls next', () => {
    const req = createReq({
      method: 'POST',
      path: '/employees',
      user: { id: 1, organizationId: 7, role: 'EMPLOYER', email: 'a@b.com' },
    });

    auditAction('employee_created', 'employee')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.json({ data: { id: 42, name: 'Jane' } });

    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        resourceType: 'employee',
        newState: { id: 42, name: 'Jane' },
        actorId: 1,
      })
    );
  });

  it('does not log a non-mutating GET request', () => {
    const req = createReq({
      method: 'GET',
      user: { id: 1, organizationId: 7, role: 'EMPLOYER' },
    });

    auditAction('employee_created', 'employee')(req, res, next);
    res.json({ ok: true });

    expect(mockLog).not.toHaveBeenCalled();
  });

  it('does not log an unsuccessful (error-status) request', () => {
    const req = createReq({
      method: 'DELETE',
      user: { id: 1, organizationId: 7, role: 'EMPLOYER' },
    });
    res.statusCode = 500;

    auditAction('employee_deleted', 'employee')(req, res, next);
    res.json({ error: 'nope' });

    expect(mockLog).not.toHaveBeenCalled();
  });
});
