import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { pool } from '../config/database.js';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';
import { ThrottlingService } from '../services/throttlingService.js';
import { register as metricsRegister } from '../utils/metrics.js';

/**
 * Shared Redis client for health checks.
 * Uses a fail-fast strategy to prevent health check hangs.
 */
let redisClient: Redis | null = null;
if (config.REDIS_URL) {
  try {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Fail fast for health check
      commandTimeout: 1000, // 1 second timeout
    });

    redisClient.on('error', (err) => {
      logger.warn('Health Check Redis client error', { error: err.message });
    });
  } catch (err) {
    logger.error('Failed to initialize Health Check Redis client', err);
  }
}

export interface DependencyStatus {
  status: 'connected' | 'disconnected' | 'not_configured' | 'unknown';
  error?: string;
  latencyMs?: number;
}

export interface PoolStatus {
  total: number;
  idle: number;
  waiting: number;
}

export interface ThrottlingStatusSummary {
  queueSize: number;
  processed: number;
  rejected: number;
  tpm: number;
}

export interface HealthStatusResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: {
    name: string;
    nodeVersion: string;
  };
  system: {
    memoryUsage: NodeJS.MemoryUsage;
    platform: string;
    eventLoopLag?: number;
  };
  pool?: PoolStatus;
  throttling?: ThrottlingStatusSummary;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

function measureEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => resolve(Date.now() - start));
  });
}

export class HealthController {
  /**
   * GET /health/live  (liveness probe)
   * Returns 200 immediately — no dependency checks. Used by k8s/Docker to
   * confirm the process is alive. Should never block or timeout.
   */
  static getLiveness(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  /**
   * GET /health/ready  (readiness probe)
   * Returns 200 if all critical dependencies are reachable, 503 otherwise.
   * Used by load-balancers to gate traffic until the instance is ready.
   */
  static async getReadiness(_req: Request, res: Response): Promise<void> {
    const checks: { database: DependencyStatus; redis: DependencyStatus } = {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
    };
    let ready = true;

    const dbStart = Date.now();
    try {
      await pool.query('SELECT 1');
      checks.database = { status: 'connected', latencyMs: Date.now() - dbStart };
    } catch (error: any) {
      ready = false;
      checks.database = { status: 'disconnected', error: error.message };
      logger.error('Readiness check: database unavailable', error);
    }

    if (redisClient) {
      const redisStart = Date.now();
      try {
        await redisClient.ping();
        checks.redis = { status: 'connected', latencyMs: Date.now() - redisStart };
      } catch (error: any) {
        ready = false;
        checks.redis = { status: 'disconnected', error: error.message };
        logger.error('Readiness check: redis unavailable', error);
      }
    } else {
      checks.redis = { status: 'not_configured' };
    }

    const httpStatus = ready ? 200 : 503;
    res.status(httpStatus).json({
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  static async getHealthStatus(_req: Request, res: Response) {
    const start = Date.now();
    const statusReport: HealthStatusResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: {
        name: config.NODE_ENV,
        nodeVersion: process.version,
      },
      system: {
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
      },
      dependencies: {
        database: { status: 'unknown' },
        redis: { status: 'unknown' },
      },
    };

    let isHealthy = true;

    const eventLoopLag = await measureEventLoopLag();
    statusReport.system.eventLoopLag = eventLoopLag;

    if (eventLoopLag > 1000) {
      logger.warn('High event loop lag detected', { lagMs: eventLoopLag });
    }

    const dbStart = Date.now();
    try {
      await pool.query('SELECT 1');
      statusReport.dependencies.database = {
        status: 'connected',
        latencyMs: Date.now() - dbStart,
      };
      statusReport.pool = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      };
    } catch (error: any) {
      isHealthy = false;
      statusReport.dependencies.database = {
        status: 'disconnected',
        error: error.message,
      };
      logger.error('Health Check: Database connection failed', error);
    }

    if (redisClient) {
      const redisStart = Date.now();
      try {
        await redisClient.ping();
        statusReport.dependencies.redis = {
          status: 'connected',
          latencyMs: Date.now() - redisStart,
        };
      } catch (error: any) {
        isHealthy = false;
        statusReport.dependencies.redis = {
          status: 'disconnected',
          error: error.message,
        };
        logger.error('Health Check: Redis connection failed', error);
      }
    } else {
      statusReport.dependencies.redis = { status: 'not_configured' };
    }

    const throttlingStatus = ThrottlingService.getInstance().getStatus();
    statusReport.throttling = {
      queueSize: throttlingStatus.queueSize,
      processed: throttlingStatus.processedCount,
      rejected: throttlingStatus.rejectedCount,
      tpm: throttlingStatus.tpm,
    };

    if (!isHealthy) {
      statusReport.status = 'degraded';
      return res.status(503).json(statusReport);
    }

    return res.status(200).json(statusReport);
  }
}
