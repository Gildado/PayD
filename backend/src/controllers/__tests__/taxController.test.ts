import request from 'supertest';
import express from 'express';

// Mock TaxService with an explicit factory so the real module (and its
// database imports) is never executed during controller tests.
const mockGetRuleById = jest.fn();
const mockUpdateRule = jest.fn();
const mockCreateRule = jest.fn();
const mockGetRules = jest.fn();
const mockDeleteRule = jest.fn();
const mockCalculateDeductions = jest.fn();
const mockGenerateReport = jest.fn();

jest.mock('../../services/taxService', () => ({
  TaxService: jest.fn().mockImplementation(() => ({
    getRuleById: mockGetRuleById,
    updateRule: mockUpdateRule,
    createRule: mockCreateRule,
    getRules: mockGetRules,
    deleteRule: mockDeleteRule,
    calculateDeductions: mockCalculateDeductions,
    generateReport: mockGenerateReport,
  })),
}));

import taxRoutes from '../../routes/taxRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/taxes', taxRoutes);

const baseRule = {
  id: 1,
  organization_id: 1,
  name: 'Test Rule',
  type: 'fixed' as const,
  value: 50000,
  description: null,
  is_active: true,
  priority: 0,
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  jest.resetAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/taxes/rules
// ---------------------------------------------------------------------------
describe('POST /api/taxes/rules', () => {
  it('rejects a percentage rule with value above 100', async () => {
    const res = await request(app)
      .post('/api/taxes/rules')
      .send({ organization_id: 1, name: 'Bad Tax', type: 'percentage', value: 150 })
      .expect(400);

    expect(res.body.error).toMatch(/percentage value must be between 0 and 100/i);
    expect(mockCreateRule).not.toHaveBeenCalled();
  });

  it('accepts a valid percentage rule', async () => {
    mockCreateRule.mockResolvedValue({ ...baseRule, type: 'percentage', value: 22 });

    const res = await request(app)
      .post('/api/taxes/rules')
      .send({ organization_id: 1, name: 'Income Tax', type: 'percentage', value: 22 })
      .expect(201);

    expect(res.body.value).toBe(22);
    expect(mockCreateRule).toHaveBeenCalledTimes(1);
  });

  it('accepts a fixed rule with any non-negative value', async () => {
    mockCreateRule.mockResolvedValue(baseRule);

    await request(app)
      .post('/api/taxes/rules')
      .send({ organization_id: 1, name: 'Flat Fee', type: 'fixed', value: 50000 })
      .expect(201);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/taxes/rules/:id — type-change re-validation (issue #928)
// ---------------------------------------------------------------------------
describe('PUT /api/taxes/rules/:id — type-change re-validation', () => {
  it('rejects changing type to "percentage" when the existing value exceeds 100', async () => {
    // Rule was created as a fixed fee with value=50000.
    // Changing only the type to "percentage" must be rejected because 50000 > 100.
    mockGetRuleById.mockResolvedValue({ ...baseRule, type: 'fixed', value: 50000 });

    const res = await request(app)
      .put('/api/taxes/rules/1')
      .send({ type: 'percentage' })
      .expect(400);

    expect(res.body.error).toMatch(/not valid for type.*percentage/i);
    expect(mockUpdateRule).not.toHaveBeenCalled();
  });

  it('rejects when both type="percentage" and an out-of-range value are supplied together', async () => {
    // value is provided so getRuleById should NOT be called
    const res = await request(app)
      .put('/api/taxes/rules/1')
      .send({ type: 'percentage', value: 200 })
      .expect(400);

    expect(res.body.error).toMatch(/not valid for type.*percentage/i);
    expect(mockGetRuleById).not.toHaveBeenCalled();
    expect(mockUpdateRule).not.toHaveBeenCalled();
  });

  it('allows changing type to "percentage" when the existing value is within 0–100', async () => {
    mockGetRuleById.mockResolvedValue({ ...baseRule, type: 'fixed', value: 22 });
    mockUpdateRule.mockResolvedValue({ ...baseRule, type: 'percentage', value: 22 });

    const res = await request(app)
      .put('/api/taxes/rules/1')
      .send({ type: 'percentage' })
      .expect(200);

    expect(res.body.type).toBe('percentage');
    expect(mockUpdateRule).toHaveBeenCalledTimes(1);
  });

  it('allows changing type from "percentage" to "fixed" regardless of value', async () => {
    mockGetRuleById.mockResolvedValue({ ...baseRule, type: 'percentage', value: 22 });
    mockUpdateRule.mockResolvedValue({ ...baseRule, type: 'fixed', value: 22 });

    const res = await request(app)
      .put('/api/taxes/rules/1')
      .send({ type: 'fixed' })
      .expect(200);

    expect(res.body.type).toBe('fixed');
  });

  it('returns 404 when rule does not exist and type is changing without a value', async () => {
    mockGetRuleById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/taxes/rules/999')
      .send({ type: 'percentage' })
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
    expect(mockUpdateRule).not.toHaveBeenCalled();
  });

  it('does not call getRuleById when type is not part of the update', async () => {
    mockUpdateRule.mockResolvedValue({ ...baseRule, name: 'Renamed' });

    await request(app).put('/api/taxes/rules/1').send({ name: 'Renamed' }).expect(200);

    expect(mockGetRuleById).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PUT /api/taxes/rules/:id — basic validation
// ---------------------------------------------------------------------------
describe('PUT /api/taxes/rules/:id — basic validation', () => {
  it('rejects an unrecognised type value', async () => {
    const res = await request(app)
      .put('/api/taxes/rules/1')
      .send({ type: 'flat' })
      .expect(400);

    expect(res.body.error).toMatch(/type must be/i);
  });

  it('rejects a negative value', async () => {
    const res = await request(app)
      .put('/api/taxes/rules/1')
      .send({ value: -5 })
      .expect(400);

    expect(res.body.error).toMatch(/non-negative/i);
  });

  it('returns 404 when updateRule returns null (rule not found, no type change)', async () => {
    mockUpdateRule.mockResolvedValue(null);

    await request(app).put('/api/taxes/rules/999').send({ name: 'X' }).expect(404);
  });
});
