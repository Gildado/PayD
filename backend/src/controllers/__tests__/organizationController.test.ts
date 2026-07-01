import request from 'supertest';
import express from 'express';

// ── Env mock (must come before any imports that pull in config) ──────────────
jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}));

// ── Auth / RBAC middleware stubs ─────────────────────────────────────────────
jest.mock('../../middlewares/auth.js', () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    req.user = { id: 1, organizationId: 42, role: 'EMPLOYER', email: 'admin@acme.com' };
    next();
  },
}));

jest.mock('../../middlewares/rbac.js', () => ({
  __esModule: true,
  authorizeRoles: () => (_req: any, _res: any, next: any) => next(),
  isolateOrganization: (_req: any, _res: any, next: any) => next(),
}));

// Pass-through the admin 2FA gate here so these tests stay focused on the
// controller. The gate itself is covered in require2faForAdmin.test.ts.
jest.mock('../../middlewares/require2faForAdmin.js', () => ({
  __esModule: true,
  require2FAForAdmin: (_req: any, _res: any, next: any) => next(),
  default: (_req: any, _res: any, next: any) => next(),
}));

// ── Database mock ─────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../../config/database.js', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

// ── Stellar Horizon mock ──────────────────────────────────────────────────────
const mockLoadAccount = jest.fn();
jest.mock('../../stellar/index.js', () => ({
  getStellarServer: () => ({ loadAccount: (...args: unknown[]) => mockLoadAccount(...args) }),
}));

// ── OrgAuditService mock ──────────────────────────────────────────────────────
const mockAuditLog = jest.fn().mockResolvedValue(null);
jest.mock('../../services/orgAuditService.js', () => ({
  orgAuditService: { log: (...args: unknown[]) => mockAuditLog(...args) },
}));

import organizationRoutes from '../../routes/organizationRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/v1/organizations', organizationRoutes);

// ─────────────────────────────────────────────────────────────────────────────
describe('OrganizationController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /me ─────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/me', () => {
    it('returns the organization profile', async () => {
      const mockOrg = {
        id: 42,
        name: 'Acme Corp',
        issuer_account: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockOrg] });

      const res = await request(app).get('/api/v1/organizations/me');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Acme Corp');
    });

    it('returns 404 when organization does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/v1/organizations/me');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('returns 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app).get('/api/v1/organizations/me');
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });
  });

  // ── PATCH /me/name ──────────────────────────────────────────────────────────
  describe('PATCH /api/v1/organizations/me/name', () => {
    it('updates the organization name and writes an audit entry', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ name: 'Old Corp' }] })           // SELECT old name
        .mockResolvedValueOnce({ rows: [{ id: 42, name: 'New Corp', updated_at: '2025-06-01' }] }); // UPDATE

      const res = await request(app)
        .patch('/api/v1/organizations/me/name')
        .send({ name: 'New Corp' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Corp');

      // Audit log must have been called
      expect(mockAuditLog).toHaveBeenCalledTimes(1);
      const auditArgs = mockAuditLog.mock.calls[0][0];
      expect(auditArgs.changeType).toBe('name_updated');
      expect(auditArgs.oldValue).toBe('Old Corp');
      expect(auditArgs.newValue).toBe('New Corp');
      expect(auditArgs.organizationId).toBe(42);
    });

    it('returns 400 for an empty name', async () => {
      const res = await request(app)
        .patch('/api/v1/organizations/me/name')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when name field is missing', async () => {
      const res = await request(app)
        .patch('/api/v1/organizations/me/name')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when the org row is gone', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ name: 'Old' }] }) // old name
        .mockResolvedValueOnce({ rows: [] });                 // UPDATE returns nothing

      const res = await request(app)
        .patch('/api/v1/organizations/me/name')
        .send({ name: 'New' });

      expect(res.status).toBe(404);
    });

    it('returns 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB failure'));

      const res = await request(app)
        .patch('/api/v1/organizations/me/name')
        .send({ name: 'Foo' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });
  });

  // ── PATCH /me/issuer ────────────────────────────────────────────────────────
  describe('PATCH /api/v1/organizations/me/issuer', () => {
    const validKey = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGWKX2ZWCD45D3LZKZN7SOM';

    it('updates the issuer account and writes an audit entry', async () => {
      const newKey = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGWKX2ZWCD45D3LZKZN7SOM';
      mockLoadAccount.mockResolvedValueOnce({ id: newKey }); // account exists on-chain
      mockQuery
        .mockResolvedValueOnce({ rows: [{ issuer_account: validKey }] })  // SELECT old
        .mockResolvedValueOnce({ rows: [{ id: 42, issuer_account: newKey, updated_at: '2025-06-01' }] });

      const res = await request(app)
        .patch('/api/v1/organizations/me/issuer')
        .send({ issuerAccount: newKey });

      expect(res.status).toBe(200);
      expect(res.body.data.issuer_account).toBe(newKey);

      expect(mockAuditLog).toHaveBeenCalledTimes(1);
      const auditArgs = mockAuditLog.mock.calls[0][0];
      expect(auditArgs.changeType).toBe('issuer_updated');
      expect(auditArgs.oldValue).toBe(validKey);
      expect(auditArgs.newValue).toBe(newKey);
    });

    it('returns 400 for an invalid Stellar key', async () => {
      const res = await request(app)
        .patch('/api/v1/organizations/me/issuer')
        .send({ issuerAccount: 'NOTAKEY' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when issuerAccount is missing', async () => {
      const res = await request(app)
        .patch('/api/v1/organizations/me/issuer')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 422 when the account does not exist on the Stellar network', async () => {
      const notFoundError = { response: { status: 404 } };
      mockLoadAccount.mockRejectedValueOnce(notFoundError);

      const res = await request(app)
        .patch('/api/v1/organizations/me/issuer')
        .send({ issuerAccount: validKey });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/does not exist on the Stellar network/i);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 502 when Horizon is unreachable', async () => {
      mockLoadAccount.mockRejectedValueOnce(new Error('Network timeout'));

      const res = await request(app)
        .patch('/api/v1/organizations/me/issuer')
        .send({ issuerAccount: validKey });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('INTERNAL_ERROR');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 500 on database error', async () => {
      mockLoadAccount.mockResolvedValueOnce({ id: validKey }); // Horizon succeeds
      mockQuery.mockRejectedValueOnce(new Error('DB failure'));

      const res = await request(app)
        .patch('/api/v1/organizations/me/issuer')
        .send({ issuerAccount: validKey });

      expect(res.status).toBe(500);
    });
  });
});
