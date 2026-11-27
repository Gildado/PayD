import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import { requestLogger } from '../requestLogger.js';
import { httpRequestTotal, httpRequestDuration } from '../../utils/metrics.js';

type LabelSet = Record<string, string>;

describe('requestLogger metric labels', () => {
  let totalSpy: ReturnType<typeof jest.spyOn>;
  let durationSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    totalSpy = jest.spyOn(httpRequestTotal, 'inc').mockImplementation(() => {});
    durationSpy = jest.spyOn(httpRequestDuration, 'observe').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  function lastLabels(): LabelSet {
    const calls = totalSpy.mock.calls as unknown as Array<[LabelSet]>;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0];
  }

  it('labels parameterized routes with the matched pattern and no raw IDs', async () => {
    const app = express();
    app.use(requestLogger);
    app.get('/api/employees/:id/payroll', (req, res) => {
      const scoped = req as typeof req & {
        tenantId: number;
        user: { id: number; organizationId: number };
      };
      scoped.tenantId = 42;
      scoped.user = { id: 7, organizationId: 42 };
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/api/employees/42/payroll');

    expect(response.status).toBe(200);
    const labels = lastLabels();
    expect(labels.method).toBe('GET');
    expect(labels.status_code).toBe('200');
    expect(labels.route).toBe('/api/employees/:id/payroll');
    expect(labels.route).not.toContain('42');
    expect(labels.tenant).toMatch(/^tenant_[0-9a-f]{2}$/);
    expect(labels.user).toMatch(/^user_[0-9a-f]{2}$/);
    expect(labels.tenant).not.toContain('42');
    expect(labels.user).not.toContain('7');

    // The same labels are used for the latency histogram.
    const durationCalls = durationSpy.mock.calls as unknown as Array<[LabelSet, number]>;
    expect(durationCalls[durationCalls.length - 1][0]).toEqual(labels);
  });

  it('sanitizes concrete IDs on unmatched (404) routes', async () => {
    const app = express();
    app.use(requestLogger);

    const response = await request(app).get('/api/employees/12345/unknown');

    expect(response.status).toBe(404);
    const labels = lastLabels();
    expect(labels.route).toBe('/api/employees/:id/unknown');
    expect(labels.route).not.toContain('12345');
  });
});
