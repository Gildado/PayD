import { jest, describe, it, expect } from '@jest/globals';
import { CircuitBreakerIncidentReportAgent } from '../circuitBreakerIncidentReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_STATE_ROWS,
  FIXTURE_EVENT_ROWS,
  FIXTURE_ROOT_ROWS,
  FIXTURE_EXPECTED,
} from './fixtures/circuitBreakerIncidentFixture.js';

function makePool(overrides: { state?: unknown[]; events?: unknown[]; root?: unknown[] } = {}): Pool {
  const fn = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('circuit_breaker_state')) return Promise.resolve({ rows: overrides.state ?? [] });
    if (sql.includes('circuit_name') && sql.includes('GROUP BY')) return Promise.resolve({ rows: overrides.root ?? [] });
    if (sql.includes('circuit_breaker_events')) return Promise.resolve({ rows: overrides.events ?? [] });
    return Promise.resolve({ rows: [] });
  });
  return { query: fn } as unknown as Pool;
}

describe('CircuitBreakerIncidentReportAgent', () => {
  describe('execute()', () => {
    it('returns correct circuit state summary', async () => {
      const pool = makePool({ state: FIXTURE_STATE_ROWS, events: FIXTURE_EVENT_ROWS, root: FIXTURE_ROOT_ROWS });
      const agent = new CircuitBreakerIncidentReportAgent(pool);

      const result = await agent.execute({});
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.totalCircuits).toBe(FIXTURE_EXPECTED.totalCircuits);
      expect(report.summary.openCircuits).toBe(FIXTURE_EXPECTED.openCircuits);
      expect(report.summary.halfOpenCircuits).toBe(FIXTURE_EXPECTED.halfOpenCircuits);
      expect(report.summary.closedCircuits).toBe(FIXTURE_EXPECTED.closedCircuits);
    });

    it('identifies most-tripped circuit', async () => {
      const pool = makePool({ state: FIXTURE_STATE_ROWS, events: FIXTURE_EVENT_ROWS, root: FIXTURE_ROOT_ROWS });
      const agent = new CircuitBreakerIncidentReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.summary.mostTrippedCircuit).toBe(FIXTURE_EXPECTED.mostTrippedCircuit);
    });

    it('returns root services ranked by trip count', async () => {
      const pool = makePool({ state: FIXTURE_STATE_ROWS, events: FIXTURE_EVENT_ROWS, root: FIXTURE_ROOT_ROWS });
      const agent = new CircuitBreakerIncidentReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.rootServices).toHaveLength(FIXTURE_EXPECTED.rootServiceCount);
      expect(report.rootServices[0].circuitName).toBe('redis');
      expect(report.rootServices[0].tripCount).toBe(3);
    });

    it('returns recent transitions', async () => {
      const pool = makePool({ state: FIXTURE_STATE_ROWS, events: FIXTURE_EVENT_ROWS, root: FIXTURE_ROOT_ROWS });
      const agent = new CircuitBreakerIncidentReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.recentTransitions).toHaveLength(FIXTURE_EVENT_ROWS.length);
    });

    it('returns incident details for each circuit', async () => {
      const pool = makePool({ state: FIXTURE_STATE_ROWS, events: FIXTURE_EVENT_ROWS, root: FIXTURE_ROOT_ROWS });
      const agent = new CircuitBreakerIncidentReportAgent(pool);

      const result = await agent.execute({});
      const report = result.data![0] as any;

      expect(report.incidents).toHaveLength(FIXTURE_EXPECTED.totalCircuits);
      const redis = report.incidents.find((i: any) => i.circuitName === 'redis');
      expect(redis.state).toBe('OPEN');
      expect(redis.failureCount).toBe(5);
    });

    it('applies date filters to event queries', async () => {
      const pool = makePool({ state: FIXTURE_STATE_ROWS });
      const agent = new CircuitBreakerIncidentReportAgent(pool);

      await agent.execute({
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      });

      const calls = (pool.query as jest.Mock).mock.calls.map(([sql]: [string]) => sql);
      const eventSql = calls.find((s: string) => s.includes('circuit_breaker_events'));
      expect(eventSql).toContain('created_at >= $1');
      expect(eventSql).toContain('created_at <= $2');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new CircuitBreakerIncidentReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
