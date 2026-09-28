/**
 * @file src/routes/scalingRoutes.ts
 * @description REST endpoints that expose DB connection-pool health and
 *              slow-query statistics.  Part of the API & Database Scaling
 *              effort (Issue #272 / Wave #717).
 *
 * Routes
 * ──────
 *   GET  /api/v1/scaling/health              – current pool snapshot
 *   GET  /api/v1/scaling/query-stats         – recent slow queries
 *   POST /api/v1/scaling/refresh-view        – refresh the daily-summary mat-view
 *   GET  /api/v1/scaling/latency-percentiles – p50/p95/p99 per endpoint (Part 25)
 *   GET  /api/v1/scaling/pool-history        – pool snapshots time-series (Part 25)
 *   GET  /api/v1/scaling/xid-wraparound      – XID wraparound risk (Part 35)
 *   GET  /api/v1/scaling/index-bloat         – index bloat estimates (Part 35)
 *   GET  /api/v1/scaling/table-io            – per-table I/O stats (Part 35)
 *   GET  /api/v1/scaling/autovacuum          – live autovacuum activity (Part 35)
 *   GET  /api/v1/scaling/slow-query-agg      – slow-query aggregates (Part 35)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getPool, getPoolStats } from '../services/dbPoolService.js';
import { DbScalingService } from '../services/dbScalingService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

const dbScalingService = new DbScalingService();

const router = Router();

/**
 * @openapi
 * /api/v1/scaling/health:
 *   get:
 *     summary: Database connection-pool health snapshot
 *     tags: [Scaling]
 *     responses:
 *       200:
 *         description: Current pool utilisation
 */
router.get('/health', (_req: Request, res: Response) => {
  try {
    const stats = getPoolStats();
    return res.status(200).json({
      success: true,
      data: {
        totalConnections: stats.totalConns,
        idleConnections: stats.idleConns,
        waitingClients: stats.waitingClients,
        recordedAt: stats.recordedAt,
        poolUtilisationPct:
          stats.totalConns > 0
            ? Math.round(((stats.totalConns - stats.idleConns) / stats.totalConns) * 100)
            : 0,
      },
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to read pool stats');
    return res
      .status(500)
      .json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve pool health'));
  }
});

// ─── GET /scaling/query-stats ────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/scaling/query-stats:
 *   get:
 *     summary: Recent slow-query statistics (admin only)
 *     tags: [Scaling]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: minMs
 *         schema: { type: integer, default: 200 }
 *     responses:
 *       200:
 *         description: List of recent slow queries
 */
router.get('/query-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const minMs = Number(req.query.minMs ?? 200);

    const pool = getPool();
    const { rows } = await pool.query<{
      endpoint: string;
      query_hash: string;
      execution_ms: number;
      rows_returned: number;
      cache_hit: boolean;
      recorded_at: Date;
    }>(
      `SELECT endpoint, query_hash, execution_ms, rows_returned, cache_hit, recorded_at
         FROM db_query_stats
        WHERE execution_ms >= $1
        ORDER BY recorded_at DESC
        LIMIT $2`,
      [minMs, limit]
    );

    return res.status(200).json({
      success: true,
      data: rows,
      meta: { limit, minMs, count: rows.length },
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to fetch query stats');
    next(err);
  }
});

// ─── POST /scaling/refresh-view ──────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/scaling/refresh-view:
 *   post:
 *     summary: Refresh the daily transaction summary materialised view
 *     tags: [Scaling]
 *     responses:
 *       200:
 *         description: View refreshed successfully
 */
router.post('/refresh-view', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = getPool();
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_daily_tx_summary');

    logger.info('[scalingRoutes] mv_org_daily_tx_summary refreshed');
    return res.status(200).json({
      success: true,
      message: 'Materialised view mv_org_daily_tx_summary refreshed successfully.',
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to refresh materialised view');
    next(err);
  }
});

// ─── Part 25 (#715) ──────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/scaling/latency-percentiles:
 *   get:
 *     summary: p50 / p95 / p99 latency per endpoint (Part 25)
 *     description: >
 *       Computes approximate latency percentiles from the api_latency_histogram
 *       table. Returns the top endpoints by p99 so you can spot regressions.
 *     tags: [Scaling]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: windowMinutes
 *         schema: { type: integer, default: 60 }
 *     responses:
 *       200:
 *         description: Latency percentile breakdown per endpoint
 */
router.get('/latency-percentiles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const windowMinutes = Math.min(Number(req.query.windowMinutes ?? 60), 1440);

    const pool = getPool();
    const { rows } = await pool.query<{
      endpoint: string;
      method: string;
      p50_ms: number;
      p95_ms: number;
      p99_ms: number;
      total_observations: string;
      window_start: Date;
    }>(
      `SELECT
         endpoint,
         method,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY bucket_ms) AS p50_ms,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY bucket_ms) AS p95_ms,
         PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY bucket_ms) AS p99_ms,
         SUM(observations)                                        AS total_observations,
         MIN(window_start)                                        AS window_start
       FROM api_latency_histogram
       WHERE recorded_at >= NOW() - ($1 * INTERVAL '1 minute')
       GROUP BY endpoint, method
       ORDER BY p99_ms DESC NULLS LAST
       LIMIT $2`,
      [windowMinutes, limit]
    );

    return res.status(200).json({
      success: true,
      data: rows,
      meta: { limit, windowMinutes, count: rows.length },
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to fetch latency percentiles');
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/scaling/pool-history:
 *   get:
 *     summary: Recent connection-pool health snapshots (Part 25)
 *     description: >
 *       Returns time-series snapshots from db_pool_health so operators can spot
 *       connection-pool saturation trends without needing Grafana.
 *     tags: [Scaling]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Pool health snapshots, most recent first
 */
router.get('/pool-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 200);

    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      total_conns: number;
      idle_conns: number;
      waiting_clients: number;
      recorded_at: Date;
    }>(
      `SELECT id, total_conns, idle_conns, waiting_clients, recorded_at
         FROM db_pool_health
        ORDER BY recorded_at DESC
        LIMIT $1`,
      [limit]
    );

    return res.status(200).json({
      success: true,
      data: rows,
      meta: { limit, count: rows.length },
    });
  } catch (err) {
    logger.error({ err }, '[scalingRoutes] Failed to fetch pool history');
    next(err);
  }
});

export default router;
