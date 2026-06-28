import request from 'supertest';
import express from 'express';
import { HealthController } from '../healthController.js';
import { pool } from '../../config/database.js';
import { Redis } from 'ioredis';

jest.mock('../../config/env', () => ({
  config: {
    DATABASE_URL: 'postgres://mock',
    REDIS_URL: 'redis://mock',
    NODE_ENV: 'test',
  },
}));

jest.mock('../../config/database.js', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('ioredis', () => {
  const mRedis = {
    ping: jest.fn(),
    on: jest.fn(),
  };
  return { Redis: jest.fn(() => mRedis) };
});

const app = express();
app.get('/api/health', HealthController.getHealthStatus);
app.get('/api/v1/health', HealthController.getHealthStatus);
app.get('/health', HealthController.getHealthStatus);
app.get('/api/v1/health/live', HealthController.getLiveness);
app.get('/api/v1/health/ready', HealthController.getReadiness);
app.get('/health/live', HealthController.getLiveness);
app.get('/health/ready', HealthController.getReadiness);

describe('HealthController health endpoints', () => {
  let redisClient: any;

  beforeEach(() => {
    redisClient = new Redis();
    jest.clearAllMocks();
  });

  it('returns 200 OK from /api/health when database and redis are healthy', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.environment.name).toBe('test');
    expect(response.body.system.memoryUsage).toBeDefined();
    expect(response.body.system.platform).toBeDefined();
    expect(response.body.dependencies.database.status).toBe('connected');
    expect(response.body.dependencies.database.latencyMs).toBeDefined();
    expect(response.body.dependencies.redis.status).toBe('connected');
    expect(response.body.dependencies.redis.latencyMs).toBeDefined();
  });

  it('keeps the legacy /health endpoint working', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns 200 OK from /api/v1/health when database and redis are healthy', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.dependencies.database.status).toBe('connected');
    expect(response.body.dependencies.redis.status).toBe('connected');
  });

  it('returns 503 Degraded when Postgres goes down', async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Connection forced closed'));
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.database.status).toBe('disconnected');
    expect(response.body.dependencies.database.error).toBe('Connection forced closed');
  });

  it('returns 503 Degraded when Redis fails', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockRejectedValueOnce(new Error('Redis timeout'));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.dependencies.redis.status).toBe('disconnected');
    expect(response.body.dependencies.redis.error).toBe('Redis timeout');
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
    jest.clearAllMocks();
  });

  it('GET /api/v1/health/ready returns 200 when database and redis are reachable', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.checks.database.status).toBe('connected');
    expect(response.body.checks.redis.status).toBe('connected');
  });

  it('GET /api/v1/health/ready returns 503 when database is down', async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.database.status).toBe('disconnected');
    expect(response.body.checks.database.error).toBe('ECONNREFUSED');
  });

  it('GET /api/v1/health/ready returns 503 when redis is down', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockRejectedValueOnce(new Error('Redis ECONNREFUSED'));

    const response = await request(app).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.checks.redis.status).toBe('disconnected');
  });

  it('GET /health/ready also works on the short path', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    redisClient.ping.mockResolvedValueOnce('PONG');

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });
});
