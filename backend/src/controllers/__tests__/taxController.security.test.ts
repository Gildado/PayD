import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

const mockCreateRule = jest.fn();
const mockGetRules = jest.fn();
const mockAuditLog = jest.fn();

jest.unstable_mockModule('../../services/taxService.js', () => ({
  TaxService: class {
    createRule = mockCreateRule;
    getRules = mockGetRules;
    getRuleById = jest.fn();
    updateRule = jest.fn();
    deleteRule = jest.fn();
    calculateDeductions = jest.fn();
    generateReport = jest.fn();
  },
}));

jest.unstable_mockModule('../../services/adminAuditService.js', () => ({
  adminAuditService: {
    log: (...args: unknown[]) => {
      mockAuditLog(...args);
      return Promise.resolve(null);
    },
  },
}));

const { default: taxRoutes } = await import('../../routes/taxRoutes.js');

const app = express();
app.use(express.json());
app.use('/api/taxes', taxRoutes);

function tokenFor(role: 'EMPLOYER' | 'EMPLOYEE', organizationId: number | null = 1, id = 42) {
  return `Bearer ${jwt.sign({ id, organizationId, role }, config.JWT_SECRET)}`;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetRules.mockResolvedValue([]);
  mockCreateRule.mockResolvedValue({ id: 1, name: 'Rule', type: 'fixed', value: 100 });
});

describe('tax controller RBAC and audit', () => {
  test('rejects unauthenticated access', async () => {
    await request(app).get('/api/taxes/rules?organizationId=1').expect(401);
    expect(mockGetRules).not.toHaveBeenCalled();
  });

  test('rejects EMPLOYEE access to tax data', async () => {
    await request(app)
      .get('/api/taxes/rules?organizationId=1')
      .set('Authorization', tokenFor('EMPLOYEE'))
      .expect(403);
    expect(mockGetRules).not.toHaveBeenCalled();
  });

  test('audits successful EMPLOYER access', async () => {
    await request(app)
      .get('/api/taxes/rules?organizationId=1')
      .set('Authorization', tokenFor('EMPLOYER'))
      .expect(200);

    expect(mockGetRules).toHaveBeenCalledWith(1, false);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 1,
        actionType: 'tax_rules_listed',
        resourceType: 'tax',
        actorId: 42,
      })
    );
  });

  test('denies cross-organization access and does not audit a denied request', async () => {
    await request(app)
      .get('/api/taxes/rules?organizationId=1')
      .set('Authorization', tokenFor('EMPLOYER', 2))
      .expect(403);

    expect(mockGetRules).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test('audits a tax rule creation with the actor identity', async () => {
    await request(app)
      .post('/api/taxes/rules')
      .set('Authorization', tokenFor('EMPLOYER'))
      .send({ organization_id: 1, name: 'VAT', type: 'fixed', value: 500 })
      .expect(201);

    expect(mockCreateRule).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'tax_rule_created', actorId: 42 })
    );
  });
});

describe('taxController static checks', () => {
  test('contains no console calls and no explicit any types', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(here, '..', 'taxController.ts'), 'utf8');
    expect(source).not.toMatch(/\bconsole\./);
    expect(source).not.toMatch(/\bany\b/);
  });
});
