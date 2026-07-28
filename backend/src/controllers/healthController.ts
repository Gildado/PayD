import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { pool } from '../config/database.js';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';
import { ThrottlingService } from '../services/throttlingService.js';
import { testConnection, testSorobanConnection } from '../stellar/index.js';

// Import shutdown state from index.ts (#1048)
let isShuttingDown = false;
try {
  const indexModule = await import('../index.js');
  if ('isShuttingDown' in indexModule) {
    isShuttingDown = (indexModule as any).isShuttingDown;
  }
} catch {
  // index.js not yet loaded, default to false
}

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

/**
 * Elasticsearch (#1038) — only instantiated when explicitly enabled.
 * Non-critical dependency: an outage degrades overall health but never
 * takes the instance out of rotation.
 */
const ELASTICSEARCH_ENABLED = process.env.ELASTICSEARCH_ENABLED === 'true';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
let elasticsearchClient: ElasticsearchClient | null = null;
if (ELASTICSEARCH_ENABLED) {
  try {
    elasticsearchClient = new ElasticsearchClient({ node: ELASTICSEARCH_URL });
  } catch (err) {
    logger.error('Failed to initialize Health Check Elasticsearch client', err);
  }
}

/** Per-dependency check timeout (#1038 acceptance criterion: 2 seconds max). */
export const DEPENDENCY_CHECK_TIMEOUT_MS = 2000;

/** How long a computed health report may be served from cache (#1038: 5 seconds). */
export const HEALTH_CACHE_TTL_MS = 5000;

export interface DependencyStatus {
  status: 'healthy' | 'unhealthy' | 'not_configured';
  critical: boolean;
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

export interface DependencyMap {
  database: DependencyStatus;
  redis: DependencyStatus;
  stellarHorizon: DependencyStatus;
  stellarSoroban: DependencyStatus;
  elasticsearch: DependencyStatus;
  email: DependencyStatus;
}

export type OverallHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthStatusResponse {
  status: OverallHealthStatus;
  cached: boolean;
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
  dependencies: DependencyMap;
}

function measureEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => resolve(Date.now() - start));
  });
}

/**
 * Race a dependency check against a fixed timeout so one slow/hanging
 * dependency can never block the whole health endpoint (#1038: 2s max).
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} check timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ─── Individual dependency checks ───────────────────────────────────────────

async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await withTimeout(pool.query('SELECT 1'), DEPENDENCY_CHECK_TIMEOUT_MS, 'database');
    return { status: 'healthy', critical: true, latencyMs: Date.now() - start };
  } catch (error: any) {
    logger.error('Health Check: Database connection failed', error);
    return { status: 'unhealthy', critical: true, latencyMs: Date.now() - start, error: error.message };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  if (!redisClient) {
    return { status: 'not_configured', critical: true };
  }
  const start = Date.now();
  try {
    await withTimeout(redisClient.ping(), DEPENDENCY_CHECK_TIMEOUT_MS, 'redis');
    return { status: 'healthy', critical: true, latencyMs: Date.now() - start };
  } catch (error: any) {
    logger.error('Health Check: Redis connection failed', error);
    return { status: 'unhealthy', critical: true, latencyMs: Date.now() - start, error: error.message };
  }
}

async function checkStellarHorizon(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const result = await withTimeout(testConnection(), DEPENDENCY_CHECK_TIMEOUT_MS, 'stellar horizon');
    if (!result.connected) {
      return {
        status: 'unhealthy',
        critical: true,
        latencyMs: result.latencyMs ?? Date.now() - start,
        error: result.error || 'Stellar Horizon connection failed',
      };
    }
    return { status: 'healthy', critical: true, latencyMs: result.latencyMs };
  } catch (error: any) {
    logger.error('Health Check: Stellar Horizon connection failed', error);
    return { status: 'unhealthy', critical: true, latencyMs: Date.now() - start, error: error.message };
  }
}

async function checkStellarSoroban(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const result = await withTimeout(testSorobanConnection(), DEPENDENCY_CHECK_TIMEOUT_MS, 'stellar soroban');
    if (!result.configured) {
      return { status: 'not_configured', critical: true };
    }
    if (!result.connected) {
      return {
        status: 'unhealthy',
        critical: true,
        latencyMs: result.latencyMs ?? Date.now() - start,
        error: result.error || 'Soroban RPC connection failed',
      };
    }
    return { status: 'healthy', critical: true, latencyMs: result.latencyMs };
  } catch (error: any) {
    logger.error('Health Check: Stellar Soroban RPC connection failed', error);
    return { status: 'unhealthy', critical: true, latencyMs: Date.now() - start, error: error.message };
  }
}

async function checkElasticsearch(): Promise<DependencyStatus> {
  if (!ELASTICSEARCH_ENABLED || !elasticsearchClient) {
    return { status: 'not_configured', critical: false };
  }
  const start = Date.now();
  try {
    await withTimeout(elasticsearchClient.ping(), DEPENDENCY_CHECK_TIMEOUT_MS, 'elasticsearch');
    return { status: 'healthy', critical: false, latencyMs: Date.now() - start };
  } catch (error: any) {
    logger.warn('Health Check: Elasticsearch connection failed', { error: error.message });
    return { status: 'unhealthy', critical: false, latencyMs: Date.now() - start, error: error.message };
  }
}

/**
 * Lightweight, read-only reachability check for the configured email
 * provider (SendGrid or Resend). Deliberately does NOT reuse the providers'
 * `validateConfig()` methods, which send a real (if intentionally-invalid)
 * email on every call — unacceptable for a check that runs on a health-check
 * hot path. Instead this hits a read-only, authenticated account/domains
 * endpoint that sends nothing.
 */
async function checkEmail(): Promise<DependencyStatus> {
  const provider = config.EMAIL_PROVIDER;
  const apiKey = provider === 'sendgrid' ? config.SENDGRID_API_KEY : config.RESEND_API_KEY;

  if (!apiKey) {
    return { status: 'not_configured', critical: false };
  }

  const start = Date.now();
  const url =
    provider === 'sendgrid' ? 'https://api.sendgrid.com/v3/user/account' : 'https://api.resend.com/domains';

  try {
    const response = await withTimeout(
      fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } }),
      DEPENDENCY_CHECK_TIMEOUT_MS,
      `email (${provider})`
    );
    const latencyMs = Date.now() - start;

    // 401/403 means the configured key is invalid — a real, actionable outage.
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'unhealthy',
        critical: false,
        latencyMs,
        error: `${provider} authentication failed (HTTP ${response.status})`,
      };
    }

    // Any other response (including 2xx/4xx for the account/domains endpoint)
    // means the provider is reachable and processing authenticated requests.
    return { status: 'healthy', critical: false, latencyMs };
  } catch (error: any) {
    logger.warn(`Health Check: ${provider} connection failed`, { error: error.message });
    return { status: 'unhealthy', critical: false, latencyMs: Date.now() - start, error: error.message };
  }
}

// ─── Aggregation + 5s cache (#1038) ──────────────────────────────────────────

interface CachedReport {
  dependencies: DependencyMap;
  overallStatus: OverallHealthStatus;
  computedAt: number;
}

let cachedReport: CachedReport | null = null;

/** Test-only hook to reset the in-memory health-check cache between tests. */
export function _resetHealthCacheForTests(): void {
  cachedReport = null;
}

function computeOverallStatus(dependencies: DependencyMap): OverallHealthStatus {
  const values = Object.values(dependencies);
  const criticalUnhealthy = values.some((d) => d.critical && d.status === 'unhealthy');
  if (criticalUnhealthy) return 'unhealthy';

  const nonCriticalUnhealthy = values.some((d) => !d.critical && d.status === 'unhealthy');
  if (nonCriticalUnhealthy) return 'degraded';

  return 'healthy';
}

/**
 * Runs all dependency checks in parallel and caches the result for
 * `HEALTH_CACHE_TTL_MS` (5 seconds) so repeated health/readiness probes
 * (common under k8s, which polls every few seconds) don't hammer every
 * external dependency on every single request (#1038).
 */
async function getDependencyReport(): Promise<CachedReport> {
  const now = Date.now();
  if (cachedReport && now - cachedReport.computedAt < HEALTH_CACHE_TTL_MS) {
    return cachedReport;
  }

  const [database, redis, stellarHorizon, stellarSoroban, elasticsearch, email] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStellarHorizon(),
    checkStellarSoroban(),
    checkElasticsearch(),
    checkEmail(),
  ]);

  const dependencies: DependencyMap = { database, redis, stellarHorizon, stellarSoroban, elasticsearch, email };
  const overallStatus = computeOverallStatus(dependencies);

  cachedReport = { dependencies, overallStatus, computedAt: now };
  return cachedReport;
}

export class HealthController {
  /**
   * GET /health/live  (liveness probe)
   * Returns 200 immediately — no dependency checks, no cache lookup. Used by
   * k8s/Docker to confirm the process is alive and the event loop is not
   * deadlocked. Should never block or timeout.
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
   * Returns 200 only if all CRITICAL dependencies (Postgres, Redis if
   * configured, Stellar Horizon, Stellar Soroban RPC if configured) are
   * healthy; 503 otherwise. A non-critical dependency (Elasticsearch, email)
   * being down never blocks readiness. Returns 503 during graceful shutdown
   * (#1048). Shares the same 5s cache as /health (#1038).
   */
  static async getReadiness(_req: Request, res: Response): Promise<void> {
    // Return 503 if shutting down
    try {
      const indexModule = await import('../index.js');
      if ((indexModule as any).isShuttingDown === true) {
        return void res.status(503).json({
          status: 'shutting_down',
          timestamp: new Date().toISOString(),
          message: 'Server is gracefully shutting down',
        });
      }
    } catch {
      // If can't import, proceed with normal checks
    }

    const { dependencies } = await getDependencyReport();

    // "not_configured" critical deps (e.g. Redis not wired up in this
    // environment) are an intentional operator choice, not a failure — only
    // an actively-unreachable critical dependency blocks readiness.
    const ready = Object.values(dependencies).every((d) => !d.critical || d.status !== 'unhealthy');

    const httpStatus = ready ? 200 : 503;
    res.status(httpStatus).json({
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: dependencies,
    });
  }

  /**
   * GET /health  (comprehensive health check, #1038)
   * Returns per-dependency status (healthy/degraded/unhealthy) with latency
   * in ms for every external dependency: PostgreSQL, Redis, Stellar Horizon,
   * Stellar Soroban RPC, Elasticsearch, and the configured email provider.
   * A non-critical dependency failure degrades overall status to
   * "degraded" (still 200 OK); a critical dependency failure returns
   * "unhealthy" (503). Cached for 5 seconds; each individual check is
   * bounded by a 2-second timeout.
   */
  static async getHealthStatus(_req: Request, res: Response) {
    const eventLoopLag = await measureEventLoopLag();
    if (eventLoopLag > 1000) {
      logger.warn('High event loop lag detected', { lagMs: eventLoopLag });
    }

    const wasCachedBefore = cachedReport !== null && Date.now() - cachedReport.computedAt < HEALTH_CACHE_TTL_MS;
    const { dependencies, overallStatus } = await getDependencyReport();

    const statusReport: HealthStatusResponse = {
      status: overallStatus,
      cached: wasCachedBefore,
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
        eventLoopLag,
      },
      dependencies,
    };

    if (dependencies.database.status === 'healthy') {
      statusReport.pool = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      };
    }

    const throttlingStatus = ThrottlingService.getInstance().getStatus();
    statusReport.throttling = {
      queueSize: throttlingStatus.queueSize,
      processed: throttlingStatus.processedCount,
      rejected: throttlingStatus.rejectedCount,
      tpm: throttlingStatus.tpm,
    };

    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
    return res.status(httpStatus).json(statusReport);
  }
}
