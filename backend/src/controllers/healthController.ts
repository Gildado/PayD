import { Request, Response } from 'express';
import pg from 'pg';
import Redis from 'ioredis';
import { config } from '../config/env';
import { StellarService } from '../services/stellarService';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

// We use 'any' to temporarily bypass the TS namespace error
export const redis: any | null = config.REDIS_URL ? new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Fail fast for health check
}) : null;

export class HealthController {
    static async getHealthStatus(req: Request, res: Response) {
        const timestamp = new Date().toISOString();
        const uptime = process.uptime();
        const version = process.env.npm_package_version || '1.0.0';

        const statusReport: any = {
            status: 'ok',
            timestamp,
            uptime,
            version,
            environment: config.NODE_ENV,
            dependencies: {
                database: { status: 'unknown' },
                redis: { status: 'unknown' },
                horizon: { status: 'unknown' }
            }
        };

        let isHealthy = true;

        // 1. PostgreSQL Check
        try {
            await pool.query('SELECT 1');
            statusReport.dependencies.database.status = 'connected';
        } catch (error: any) {
            isHealthy = false;
            statusReport.dependencies.database.status = 'disconnected';
            statusReport.dependencies.database.error = error.message;
        }

        // 2. Redis Check
        if (redis) {
            try {
                await redis.ping();
                statusReport.dependencies.redis.status = 'connected';
            } catch (error: any) {
                isHealthy = false;
                statusReport.dependencies.redis.status = 'disconnected';
                statusReport.dependencies.redis.error = error.message;
            }
        } else {
            statusReport.dependencies.redis.status = 'not_configured';
        }

        // 3. Stellar Horizon Check
        try {
            const server = StellarService.getServer();
            await server.feeStats();
            statusReport.dependencies.horizon.status = 'connected';
        } catch (error: any) {
            isHealthy = false;
            statusReport.dependencies.horizon.status = 'disconnected';
            statusReport.dependencies.horizon.error = error.message;
        }

        if (!isHealthy) {
            statusReport.status = 'degraded';
            res.status(503).json(statusReport);
            return;
        }

        res.status(200).json(statusReport);
    }
}
