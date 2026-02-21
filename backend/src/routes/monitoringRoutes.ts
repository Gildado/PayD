import { Router, Request, Response } from 'express';
import { metricsCollector } from '../services/monitoring/metrics';
import { tracingService } from '../services/monitoring/tracing';
import { alertingService } from '../services/monitoring/alerting';
import logger from '../services/logging/logger';

/**
 * Monitoring & Observability Routes
 *
 * Provides endpoints for:
 * - Performance metrics dashboard data
 * - Distributed tracing inspection
 * - Alert management
 * - Enhanced health checks
 */

const router = Router();

// ─── Metrics ──────────────────────────────────────────────────────────────────

/**
 * GET /api/monitoring/metrics
 * Returns aggregated performance metrics.
 */
router.get('/metrics', (_req: Request, res: Response) => {
  try {
    const summary = metricsCollector.getSummary();
    res.json({
      status: 'ok',
      data: summary,
    });
  } catch (error) {
    logger.error('Failed to retrieve metrics', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// ─── Traces ───────────────────────────────────────────────────────────────────

/**
 * GET /api/monitoring/traces
 * Returns recent completed trace spans.
 */
router.get('/traces', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const spans = tracingService.getRecentSpans(limit);
    res.json({
      status: 'ok',
      data: {
        activeSpans: tracingService.getActiveSpanCount(),
        recentSpans: spans,
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve traces', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to retrieve traces' });
  }
});

/**
 * GET /api/monitoring/traces/:traceId
 * Returns all spans for a specific trace.
 */
router.get('/traces/:traceId', (req: Request, res: Response) => {
  try {
    const spans = tracingService.getTrace(req.params.traceId);
    if (spans.length === 0) {
      res.status(404).json({ error: 'Trace not found' });
      return;
    }
    res.json({
      status: 'ok',
      data: {
        traceId: req.params.traceId,
        spans,
        totalSpans: spans.length,
        duration:
          spans.length > 0
            ? (spans[spans.length - 1].endTime || Date.now()) - spans[0].startTime
            : 0,
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve trace', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to retrieve trace' });
  }
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

/**
 * GET /api/monitoring/alerts
 * Returns recent alerts, optionally filtered.
 */
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const filter = {
      severity: req.query.severity as 'info' | 'warning' | 'critical' | undefined,
      type: req.query.type as
        | 'error_rate'
        | 'response_time'
        | 'service_down'
        | 'custom'
        | undefined,
      acknowledged:
        req.query.acknowledged !== undefined ? req.query.acknowledged === 'true' : undefined,
      limit: parseInt(req.query.limit as string, 10) || 50,
    };

    const alerts = alertingService.getAlerts(filter);
    res.json({
      status: 'ok',
      data: {
        total: alerts.length,
        alerts,
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve alerts', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

/**
 * POST /api/monitoring/alerts/:alertId/acknowledge
 * Acknowledge a specific alert.
 */
router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  try {
    const success = alertingService.acknowledgeAlert(req.params.alertId);
    if (!success) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json({ status: 'ok', message: 'Alert acknowledged' });
  } catch (error) {
    logger.error('Failed to acknowledge alert', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// ─── Health (Enhanced) ────────────────────────────────────────────────────────

/**
 * GET /api/monitoring/health
 * Enhanced health check with system metrics.
 */
router.get('/health', (_req: Request, res: Response) => {
  const summary = metricsCollector.getSummary();
  const mem = process.memoryUsage();

  const healthy = summary.errors.rate < 50; // Consider unhealthy if > 50 errors/min

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: summary.uptime,
    version: process.env.SERVICE_VERSION || '1.0.0',
    system: {
      memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      nodeVersion: process.version,
    },
    metrics: {
      totalRequests: summary.requests.total,
      errorRate: summary.errors.rate,
      avgResponseMs: summary.requests.averageDurationMs,
    },
  });
});

export default router;
