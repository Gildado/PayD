/**
 * Integration tests for the Scaling Routes (Issue #272 / Wave #717 – Part 27).
 *
 * Strategy
 * ─────────
 * • We mock the `dbPoolService` module so tests don't need a live PG instance.
 * • The pool mock returns canned stats and query results.
 * • We verify status codes, response shape, and basic error paths.
 */

import request from 'supertest';
import app from '../app.js';

// ─── Mock dbPoolService ───────────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockGetPoolStats = jest.fn();

jest.mock('../services/dbPoolService.js', () => ({
  getPool: () => ({ query: mockQuery }),
  getPoolStats: mockGetPoolStats,
  query: mockQuery,
  closePool: jest.fn(),
}));

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('GET /api/v1/scaling/health', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with pool utilisation data', async () => {
    mockGetPoolStats.mockReturnValue({
      totalConns: 10,
      idleConns: 7,
      waitingClients: 0,
      recordedAt: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await request(app).get('/api/v1/scaling/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      totalConnections: 10,
      idleConnections: 7,
      waitingClients: 0,
      poolUtilisationPct: 30,
    });
  });

  it('returns 0% utilisation when no connections exist', async () => {
    mockGetPoolStats.mockReturnValue({
      totalConns: 0,
      idleConns: 0,
      waitingClients: 0,
      recordedAt: new Date(),
    });

    const res = await request(app).get('/api/v1/scaling/health');

    expect(res.status).toBe(200);
    expect(res.body.data.poolUtilisationPct).toBe(0);
  });

  it('returns 500 when getPoolStats throws', async () => {
    mockGetPoolStats.mockImplementation(() => {
      throw new Error('pool error');
    });

    const res = await request(app).get('/api/v1/scaling/health');

    expect(res.status).toBe(500);
    expect(res.body.success).toBeUndefined();
  });
});

// ─── query-stats ─────────────────────────────────────────────────────────────

describe('GET /api/v1/scaling/query-stats', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with slow-query rows', async () => {
    const fakeRows = [
      {
        endpoint: 'GET /employees',
        query_hash: 'abc12345',
        execution_ms: 350,
        rows_returned: 100,
        cache_hit: false,
        recorded_at: new Date().toISOString(),
      },
    ];
    mockQuery.mockResolvedValue({ rows: fakeRows, rowCount: 1 });

    const res = await request(app).get('/api/v1/scaling/query-stats?limit=10&minMs=200');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].execution_ms).toBe(350);
    expect(res.body.meta).toMatchObject({ limit: 10, minMs: 200, count: 1 });
  });

  it('caps limit at 100 rows', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await request(app).get('/api/v1/scaling/query-stats?limit=999');

    const passedLimit = mockQuery.mock.calls[0][1][1];
    expect(passedLimit).toBe(100);
  });
});

// ─── refresh-view ─────────────────────────────────────────────────────────────

describe('POST /api/v1/scaling/refresh-view', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 when the view refresh succeeds', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const res = await request(app).post('/api/v1/scaling/refresh-view');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/refreshed successfully/i);
  });

  it('calls REFRESH MATERIALIZED VIEW CONCURRENTLY', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await request(app).post('/api/v1/scaling/refresh-view');

    const sqlCall: string = mockQuery.mock.calls[0][0];
    expect(sqlCall).toMatch(/REFRESH MATERIALIZED VIEW CONCURRENTLY/i);
    expect(sqlCall).toContain('mv_org_daily_tx_summary');
  });
});

// ─── Part 25: latency-percentiles ────────────────────────────────────────────

describe('GET /api/v1/scaling/latency-percentiles (Part 25)', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with percentile rows', async () => {
    const fakeRows = [
      {
        endpoint: 'GET /api/v1/employees',
        method: 'GET',
        p50_ms: 45,
        p95_ms: 120,
        p99_ms: 350,
        total_observations: '1200',
        window_start: new Date().toISOString(),
      },
    ];
    mockQuery.mockResolvedValue({ rows: fakeRows });

    const res = await request(app).get('/api/v1/scaling/latency-percentiles');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].p99_ms).toBe(350);
    expect(res.body.meta).toMatchObject({ count: 1 });
  });

  it('returns empty array when no histogram data exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/v1/scaling/latency-percentiles');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('caps limit at 100', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await request(app).get('/api/v1/scaling/latency-percentiles?limit=9999');
    const passedLimit = mockQuery.mock.calls[0][1][1];
    expect(passedLimit).toBe(100);
  });

  it('uses provided windowMinutes in query', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await request(app).get('/api/v1/scaling/latency-percentiles?windowMinutes=30');
    const passedWindow = mockQuery.mock.calls[0][1][0];
    expect(passedWindow).toBe(30);
  });
});

// ─── Part 25: pool-history ────────────────────────────────────────────────────

describe('GET /api/v1/scaling/pool-history (Part 25)', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with pool snapshot rows', async () => {
    const fakeRows = [
      {
        id: '1',
        total_conns: 10,
        idle_conns: 7,
        waiting_clients: 0,
        recorded_at: new Date().toISOString(),
      },
    ];
    mockQuery.mockResolvedValue({ rows: fakeRows });

    const res = await request(app).get('/api/v1/scaling/pool-history');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].total_conns).toBe(10);
  });

  it('caps limit at 200', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await request(app).get('/api/v1/scaling/pool-history?limit=9999');
    const passedLimit = mockQuery.mock.calls[0][1][0];
    expect(passedLimit).toBe(200);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValue(new Error('connection lost'));

    const res = await request(app).get('/api/v1/scaling/pool-history');

    expect(res.status).toBe(500);
  });
});
