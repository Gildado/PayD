/**
 * Integration tests for the Circuit-Breaker service and management API.
 * Part of the API & Database Scaling effort (Issue #256 – Part 11).
 *
 * Strategy
 * ─────────
 * • Mock `dbPoolService` so tests run without a live PostgreSQL instance.
 * • Mock `circuitBreakerService` on route-level tests to control state.
 * • Unit-test the CircuitBreakerService state machine in isolation.
 */

import request from 'supertest';
import app from '../app.js';

// ─── Mock dbPoolService ────────────────────────────────────────────────────────

const mockPoolQuery = jest.fn();

jest.mock('../services/dbPoolService.js', () => ({
  getPool: () => ({ query: mockPoolQuery }),
  getPoolStats: jest.fn().mockReturnValue({
    totalConns: 5,
    idleConns: 3,
    waitingClients: 0,
    recordedAt: new Date(),
  }),
  query: mockPoolQuery,
  closePool: jest.fn(),
}));

// ─── Mock circuitBreakerService ───────────────────────────────────────────────

const mockGetAll = jest.fn();
const mockGet = jest.fn();
const mockReset = jest.fn();

jest.mock('../services/circuitBreakerService.js', () => {
  const actual = jest.requireActual('../services/circuitBreakerService.js');
  return {
    ...actual,
    circuitBreakerService: {
      register: jest.fn(),
      getAll: mockGetAll,
      get: mockGet,
      reset: mockReset,
      execute: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
    },
    CircuitOpenError: actual.CircuitOpenError,
  };
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const closedSnapshot = {
  name: 'database',
  state: 'CLOSED' as const,
  failureCount: 0,
  successCount: 0,
  lastFailureAt: null,
  openedAt: null,
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const openSnapshot = {
  name: 'redis',
  state: 'OPEN' as const,
  failureCount: 5,
  successCount: 0,
  lastFailureAt: new Date('2026-01-01T00:01:00Z'),
  openedAt: new Date('2026-01-01T00:01:00Z'),
  updatedAt: new Date('2026-01-01T00:01:00Z'),
};

// ─── GET /api/v1/circuit-breakers ─────────────────────────────────────────────

describe('GET /api/v1/circuit-breakers', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with all circuits', async () => {
    mockGetAll.mockReturnValue([closedSnapshot, openSnapshot]);

    const res = await request(app).get('/api/v1/circuit-breakers');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.count).toBe(2);
  });

  it('returns an empty array when no circuits are registered', async () => {
    mockGetAll.mockReturnValue([]);

    const res = await request(app).get('/api/v1/circuit-breakers');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.count).toBe(0);
  });
});

// ─── GET /api/v1/circuit-breakers/summary ────────────────────────────────────

describe('GET /api/v1/circuit-breakers/summary', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns aggregated health counts', async () => {
    mockGetAll.mockReturnValue([closedSnapshot, openSnapshot]);

    const res = await request(app).get('/api/v1/circuit-breakers/summary');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.closed).toBe(1);
    expect(res.body.data.open).toBe(1);
    expect(res.body.data.halfOpen).toBe(0);
    expect(res.body.data.healthy).toBe(false);
  });

  it('marks system healthy when all circuits are closed', async () => {
    mockGetAll.mockReturnValue([closedSnapshot]);

    const res = await request(app).get('/api/v1/circuit-breakers/summary');

    expect(res.status).toBe(200);
    expect(res.body.data.healthy).toBe(true);
  });
});

// ─── GET /api/v1/circuit-breakers/:name ──────────────────────────────────────

describe('GET /api/v1/circuit-breakers/:name', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with the circuit snapshot', async () => {
    mockGet.mockReturnValue(closedSnapshot);

    const res = await request(app).get('/api/v1/circuit-breakers/database');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('database');
    expect(res.body.data.state).toBe('CLOSED');
  });

  it('returns 404 when the circuit does not exist', async () => {
    mockGet.mockReturnValue(null);

    const res = await request(app).get('/api/v1/circuit-breakers/unknown');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ─── POST /api/v1/circuit-breakers/:name/reset ───────────────────────────────

describe('POST /api/v1/circuit-breakers/:name/reset', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 and resets the circuit', async () => {
    mockGet
      .mockReturnValueOnce(openSnapshot)  // before reset
      .mockReturnValueOnce({ ...closedSnapshot, name: 'redis' }); // after reset
    mockReset.mockResolvedValue(undefined);

    const res = await request(app).post('/api/v1/circuit-breakers/redis/reset');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/reset to CLOSED/i);
    expect(mockReset).toHaveBeenCalledWith('redis');
  });

  it('returns 404 when trying to reset an unknown circuit', async () => {
    mockGet.mockReturnValue(null);

    const res = await request(app).post('/api/v1/circuit-breakers/ghost/reset');

    expect(res.status).toBe(404);
    expect(mockReset).not.toHaveBeenCalled();
  });
});

// ─── GET /api/v1/circuit-breakers/:name/events ───────────────────────────────

describe('GET /api/v1/circuit-breakers/:name/events', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with event rows', async () => {
    const fakeEvents = [
      {
        id: '1',
        event_type: 'OPENED',
        from_state: 'CLOSED',
        to_state: 'OPEN',
        failure_count: 5,
        message: null,
        recorded_at: new Date().toISOString(),
      },
    ];
    mockPoolQuery.mockResolvedValue({ rows: fakeEvents, rowCount: 1 });

    const res = await request(app).get(
      '/api/v1/circuit-breakers/database/events?limit=10&sinceHours=1',
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].event_type).toBe('OPENED');
    expect(res.body.meta).toMatchObject({
      circuit: 'database',
      sinceHours: 1,
      limit: 10,
      count: 1,
    });
  });

  it('caps limit at 200', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    await request(app).get('/api/v1/circuit-breakers/database/events?limit=9999');

    const passedLimit = mockPoolQuery.mock.calls[0][1][2];
    expect(passedLimit).toBe(200);
  });

  it('returns 400 for an invalid limit', async () => {
    const res = await request(app).get(
      '/api/v1/circuit-breakers/database/events?limit=0',
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

// ─── CircuitBreakerService unit tests ─────────────────────────────────────────

describe('CircuitBreakerService (unit)', () => {
  // Import real implementation for unit tests (bypassing module mock)
  let CircuitBreakerService: typeof import('../services/circuitBreakerService.js').CircuitBreakerService;
  let CircuitOpenError: typeof import('../services/circuitBreakerService.js').CircuitOpenError;

  beforeAll(async () => {
    // Use the actual module (not the mock used for route tests above)
    jest.resetModules();
    const mod = await import('../services/circuitBreakerService.js');
    CircuitBreakerService = mod.CircuitBreakerService;
    CircuitOpenError = mod.CircuitOpenError;
  });

  it('starts in CLOSED state', () => {
    const svc = (CircuitBreakerService as any)._instance = null;
    const instance = CircuitBreakerService.getInstance();
    instance.register('test-unit', { persist: false });
    expect(instance.get('test-unit')?.state).toBe('CLOSED');
  });

  it('opens after exceeding failure threshold', async () => {
    // Suppress DB persistence in unit tests
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const instance = CircuitBreakerService.getInstance();
    instance.register('test-fail', { failureThreshold: 3, persist: false });

    const fail = () => Promise.reject(new Error('boom'));

    for (let i = 0; i < 3; i++) {
      await instance.execute('test-fail', fail).catch(() => undefined);
    }

    expect(instance.get('test-fail')?.state).toBe('OPEN');
  });

  it('throws CircuitOpenError when OPEN and within recovery window', async () => {
    const instance = CircuitBreakerService.getInstance();
    instance.register('test-open', {
      failureThreshold: 1,
      recoveryMs: 60_000,
      persist: false,
    });

    await instance.execute('test-open', () => Promise.reject(new Error('err'))).catch(() => {});

    await expect(
      instance.execute('test-open', () => Promise.resolve('ok')),
    ).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('resets to CLOSED after manual reset', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const instance = CircuitBreakerService.getInstance();
    instance.register('test-reset', { failureThreshold: 1, persist: false });

    await instance.execute('test-reset', () => Promise.reject(new Error('err'))).catch(() => {});
    expect(instance.get('test-reset')?.state).toBe('OPEN');

    await instance.reset('test-reset');
    expect(instance.get('test-reset')?.state).toBe('CLOSED');
  });
});
