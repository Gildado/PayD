import { Request, Response, NextFunction } from 'express';
import logger from '../services/logging/logger';
import { metricsCollector } from '../services/monitoring/metrics';
import { alertingService } from '../services/monitoring/alerting';

/**
 * Error Tracking Middleware
 *
 * Catches unhandled errors, logs them with full context,
 * records error metrics, and triggers alerts when thresholds are exceeded.
 *
 * Must be registered AFTER all route handlers.
 */
export function errorTrackerMiddleware(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.status || err.statusCode || 500;
  const traceId = (req as Request & { traceId?: string }).traceId || '';
  const spanId = (req as Request & { spanId?: string }).spanId || '';

  // Build error context
  const errorContext = {
    type: 'error',
    method: req.method,
    url: req.originalUrl,
    statusCode,
    traceId,
    spanId,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack,
    query: req.query,
    params: req.params,
  };

  // Log at appropriate level
  if (statusCode >= 500) {
    logger.error(`Unhandled error: ${err.message}`, errorContext);
  } else {
    logger.warn(`Client error: ${err.message}`, errorContext);
  }

  // Record error metric
  metricsCollector.recordError(err.message, req.originalUrl);

  // Check if we need to trigger an alert
  const errorRate = metricsCollector.getErrorRate();
  if (errorRate >= 10) {
    alertingService.createAlert({
      type: 'error_rate',
      severity: errorRate >= 20 ? 'critical' : 'warning',
      title: 'High Error Rate',
      message: `${errorRate} errors in the last minute on ${req.originalUrl}`,
      metadata: {
        errorRate,
        lastError: err.message,
        path: req.originalUrl,
      },
    });
  }

  // Send error response
  if (!res.headersSent) {
    res.status(statusCode).json({
      error: statusCode >= 500 ? 'Internal server error' : err.message,
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
        stack: err.stack,
      }),
      ...(traceId && { traceId }),
    });
  }
}
