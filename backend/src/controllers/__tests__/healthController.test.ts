import request from 'supertest';
import express from 'express';
import { HealthController } from '../healthController';
import pg from 'pg';
import Redis from 'ioredis';
import { StellarService } from '../../services/stellarService';

jest.mock('pg', () => {
    const mPool = { query: jest.fn() };
    return { Pool: jest.fn(() => mPool) };
});
jest.mock('ioredis', () => {
    const mRedis = { ping: jest.fn() };
    return jest.fn(() => mRedis);
});
jest.mock('../../services/stellarService', () => ({
    StellarService: {
        getServer: jest.fn()
    }
}));

const app = express();
app.get('/health', HealthController.getHealthStatus);

describe('HealthController GET /health', () => {
    let pool: any;
    let redisClient: any;
    let mockServer: any;

    beforeEach(() => {
        pool = new pg.Pool();
        redisClient = new Redis();
        mockServer = { root: jest.fn() };
        (StellarService.getServer as jest.Mock).mockReturnValue(mockServer);

        // Mock global configurations to ensure redis triggers internally
        jest.mock('../../config/env', () => ({
            config: {
                DATABASE_URL: 'mock_db',
                REDIS_URL: 'mock_redis',
                NODE_ENV: 'test'
            }
        }));

        jest.clearAllMocks();
    });

    it('returns 200 OK when all dependencies are healthy', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        redisClient.ping.mockResolvedValueOnce('PONG');
        mockServer.root.mockResolvedValueOnce({});

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.dependencies.database.status).toBe('connected');
        expect(response.body.dependencies.redis.status).toBe('connected');
        expect(response.body.dependencies.horizon.status).toBe('connected');
    });

    it('returns 503 Degraded when Postgres goes down', async () => {
        pool.query.mockRejectedValueOnce(new Error('Connection forced closed'));
        redisClient.ping.mockResolvedValueOnce('PONG');
        mockServer.root.mockResolvedValueOnce({});

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('degraded');
        expect(response.body.dependencies.database.status).toBe('disconnected');
    });

    it('returns 503 Degraded when Redis fails', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        redisClient.ping.mockRejectedValueOnce(new Error('Redis timeout'));
        mockServer.root.mockResolvedValueOnce({});

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('degraded');
        expect(response.body.dependencies.redis.status).toBe('disconnected');
    });

    it('returns 503 Degraded when Horizon fails', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        redisClient.ping.mockResolvedValueOnce('PONG');
        mockServer.root.mockRejectedValueOnce(new Error('Horizon unreachable'));

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('degraded');
        expect(response.body.dependencies.horizon.status).toBe('disconnected');
    });
});
