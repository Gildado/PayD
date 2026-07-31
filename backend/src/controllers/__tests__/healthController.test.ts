import request from 'supertest';
import express from 'express';
import { Redis } from 'ioredis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    REDIS_URL: 'redis://mock',
    NODE_ENV: 'test',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: undefined,
    SENDGRID_API_KEY: undefined,
  },
}));

jest.mock('../../config/database.js', () => ({
  pool: {
    query: jest.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
  },
}));

jest.mock('ioredis', () => {
  const mRedis = {
    ping: jest.fn(),
    on: jest.fn(),
  };
  return { Redis: jest.fn(() => mRedis) };
});

jest.mock('@elastic/elasticsearch', () => {
  const mClient = { ping: jest.fn() };
  return { Client: jest.fn(() => mClient) };
});

jest.mock('../../stellar/index.js', () => ({
  testConnection: jest.fn(),
  testSorobanConnection: jest.fn(),
}));

// Imports AFTER the jest.mock calls above so the mocked modules are used.
import { pool } from '../../config/database.js';
import { testConnection, testSorobanConnection } from '../../stellar/index.js';
import { HealthController, _resetHealthCacheForTests } from '../healthController.js';

const app = express();
app.get('/api/health', HealthController.getHealthStatus);
app.get('/api/v1/health', HealthController.getHealthStatus);
app.get('/health', HealthController.getHealthStatus);
app.get('/api/v1/health/live', HealthController.getLiveness);
app.get('/api/v1/health/ready', HealthController.getReadiness);
app.get('/health/live', HealthController.getLiveness);
app.get('/health/ready', HealthController.getReadiness);

function mockHealthyStellar() {
  (testConnection as jest.Mock).mockResolvedValue({
    connected: true,
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    latencyMs: 12,
    ledgerSequence: 100,
  });
  (testSorobanConnection as jest.Mock).mockResolvedValue({
    configured: true,
    connected: true,
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    latencyMs: 8,
  });
}

describe('HealthController health endpoints', () => {
  let redisClient: any;
  let esClient: any;

  beforeEach(() => {
    redisClient = new Redis();
    esClient = new ElasticsearchClient();
    _resetHealthCacheForTests();
    jest.clearAllMocks();
    mockHealthyStellar();
  });

  it('returns 200 healthy from /api/health when all dependencies are healthy', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.environment.name).toBe('test');
    expect(response.body.system.memoryUsage).toBeDefined();
    expect(response.body.system.platform).toBeDefined();

    expect(response.body.dependencies.database.status).toBe('healthy');
    expect(response.body.dependencies.database.latencyMs).toBeDefined();
    expect(response.body.dependencies.redis.status).toBe('healthy');
    expect(response.body.dependencies.stellarHorizon.status).toBe('healthy');
    expect(response.body.dependencies.stellarSoroban.status).toBe('healthy');
    // Elasticsearch and email are not configured in this mock env.
    expect(response.body.dependencies.elasticsearch.status).toBe('not_configured');
    expect(response.body.dependencies.email.status).toBe('not_configured');
  });

  it('keeps the legacy /health endpoint working', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('returns 200 healthy from /api/v1/health when all dependencies are healthy', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('returns 503 unhealthy when Postgres (critical) goes down', async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Connection forced closed'));
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.dependencies.database.status).toBe('unhealthy');
    expect(response.body.dependencies.database.critical).toBe(true);
    expect(response.body.dependencies.database.error).toBe('Connection forced closed');
  });

  it('returns 503 unhealthy when Redis (critical) fails', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockRejectedValueOnce(new Error('Redis timeout'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.dependencies.redis.status).toBe('unhealthy');
    expect(response.body.dependencies.redis.error).toBe('Redis timeout');
  });

  it('returns 503 unhealthy when Stellar Horizon (critical) is unreachable', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');
    (testConnection as jest.Mock).mockResolvedValueOnce({
      connected: false,
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      latencyMs: 2001,
      error: 'timed out',
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.dependencies.stellarHorizon.status).toBe('unhealthy');
    expect(response.body.dependencies.stellarHorizon.critical).toBe(true);
  });

  it('returns 200 degraded (not unhealthy) when only Elasticsearch (non-critical) is down', async () => {
    const originalEsEnabled = process.env.ELASTICSEARCH_ENABLED;
    process.env.ELASTICSEARCH_ENABLED = 'true';

    jest.resetModules();
    jest.doMock('../../config/env', () => ({
      config: {
        DATABASE_URL: 'postgres://mock',
        REDIS_URL: 'redis://mock',
        NODE_ENV: 'test',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: undefined,
        SENDGRID_API_KEY: undefined,
      },
    }));
    jest.doMock('../../config/database.js', () => ({
      pool: { query: jest.fn().mockResolvedValue({ rows: [] }), totalCount: 1, idleCount: 1, waitingCount: 0 },
    }));
    jest.doMock('ioredis', () => {
      const mRedis = { ping: jest.fn().mockResolvedValue('PONG'), on: jest.fn() };
      return { Redis: jest.fn(() => mRedis) };
    });
    jest.doMock('@elastic/elasticsearch', () => {
      const mClient = { ping: jest.fn().mockRejectedValue(new Error('ES unreachable')) };
      return { Client: jest.fn(() => mClient) };
    });
    jest.doMock('../../stellar/index.js', () => ({
      testConnection: jest.fn().mockResolvedValue({ connected: true, network: 'testnet', horizonUrl: 'x', latencyMs: 1 }),
      testSorobanConnection: jest
        .fn()
        .mockResolvedValue({ configured: false, connected: false, network: 'testnet', rpcUrl: '', latencyMs: 0 }),
    }));

    const { HealthController: FreshHealthController } = await import('../healthController.js');
    const freshApp = express();
    freshApp.get('/api/health', FreshHealthController.getHealthStatus);

    const response = await request(freshApp).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.elasticsearch.status).toBe('unhealthy');
    expect(response.body.dependencies.elasticsearch.critical).toBe(false);

    if (originalEsEnabled === undefined) delete process.env.ELASTICSEARCH_ENABLED;
    else process.env.ELASTICSEARCH_ENABLED = originalEsEnabled;
    jest.dontMock('../../config/env');
    jest.dontMock('../../config/database.js');
    jest.dontMock('ioredis');
    jest.dontMock('@elastic/elasticsearch');
    jest.dontMock('../../stellar/index.js');
  });

  it('marks email as unhealthy (non-critical => degraded) when the provider auth fails', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ status: 401 }) as any;

    jest.resetModules();
    jest.doMock('../../config/env', () => ({
      config: {
        DATABASE_URL: 'postgres://mock',
        REDIS_URL: 'redis://mock',
        NODE_ENV: 'test',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 'test-key',
        SENDGRID_API_KEY: undefined,
      },
    }));
    jest.doMock('../../config/database.js', () => ({
      pool: { query: jest.fn().mockResolvedValue({ rows: [] }), totalCount: 1, idleCount: 1, waitingCount: 0 },
    }));
    jest.doMock('ioredis', () => {
      const mRedis = { ping: jest.fn().mockResolvedValue('PONG'), on: jest.fn() };
      return { Redis: jest.fn(() => mRedis) };
    });
    jest.doMock('../../stellar/index.js', () => ({
      testConnection: jest.fn().mockResolvedValue({ connected: true, network: 'testnet', horizonUrl: 'x', latencyMs: 1 }),
      testSorobanConnection: jest.fn().mockResolvedValue({ configured: false, connected: false, network: 'testnet', rpcUrl: '', latencyMs: 0 }),
    }));

    const { HealthController: FreshHealthController } = await import('../healthController.js');
    const freshApp = express();
    freshApp.get('/api/health', FreshHealthController.getHealthStatus);

    const response = await request(freshApp).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.email.status).toBe('unhealthy');
    expect(response.body.dependencies.email.critical).toBe(false);

    global.fetch = originalFetch;
    jest.dontMock('../../config/env');
    jest.dontMock('../../config/database.js');
    jest.dontMock('ioredis');
    jest.dontMock('../../stellar/index.js');
  });

  it('serves a cached result within the 5-second TTL instead of re-checking dependencies', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
    redisClient.ping.mockResolvedValue('PONG');

    const first = await request(app).get('/api/health');
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const callsAfterFirst = (pool.query as jest.Mock).mock.calls.length;

    const second = await request(app).get('/api/health');
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);

    // No additional dependency calls should have been made for the cached response.
    expect((pool.query as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('HealthController liveness probe', () => {
  it('GET /api/v1/health/live returns 200 without any dependency checks', async () => {
    const response = await request(app).get('/api/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('alive');
    expect(response.body.uptime).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /health/live also returns 200', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('alive');
  });

  it('liveness probe does not call pool.query', async () => {
    (pool.query as jest.Mock).mockClear();
    await request(app).get('/api/v1/health/live');
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('HealthController readiness probe', () => {
  let redisClient: any;

  beforeEach(() => {
    redisClient = new Redis();
    _resetHealthCacheForTests();
    jest.clearAllMocks();
    mockHealthyStellar();
  });

  it('GET /api/v1/health/ready returns 200 when all critical dependencies are reachable', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.checks.database.status).toBe('healthy');
    expect(response.body.checks.redis.status).toBe('healthy');
  });

  it('GET /api/v1/health/ready returns 503 when database is down', async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.database.status).toBe('unhealthy');
    expect(response.body.checks.database.error).toBe('ECONNREFUSED');
  });

  it('GET /api/v1/health/ready returns 503 when redis is down', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockRejectedValueOnce(new Error('Redis ECONNREFUSED'));

    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.redis.status).toBe('unhealthy');
  });

  it('GET /api/v1/health/ready returns 503 when Stellar Soroban RPC (critical, when configured) is unreachable', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');
    (testSorobanConnection as jest.Mock).mockResolvedValueOnce({
      configured: true,
      connected: false,
      network: 'testnet',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      latencyMs: 2001,
      error: 'timed out',
    });

    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.stellarSoroban.status).toBe('unhealthy');
  });

  it('GET /health/ready also works on the short path', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });
});
