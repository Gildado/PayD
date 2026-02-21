import { Request, Response, NextFunction } from 'express';
import logger from '../services/logging/logger';
import { metricsCollector } from '../services/monitoring/metrics';

/**
 * HTTP Request Logger Middleware
 *
 * Logs every incoming HTTP request with:
 * - Method, URL, status code, response time
 * - Request headers (sanitized), query params, IP
 * - Distributed tracing context (traceId / spanId)
 *
 * Also records request metrics for the performance dashboard.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  const startDate = new Date();

  // Capture original end to intercept response
  const originalEnd = res.end;

  res.end = function (this: Response, ...args: Parameters<Response['end']>): Response {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    // Extract tracing context if attached
    const traceId = (req as Request & { traceId?: string }).traceId || '';
    const spanId = (req as Request & { spanId?: string }).spanId || '';

    // Determine path without query params for grouping
    const routePath = req.route?.path || req.path;

    // Log the request
    const logData = {
      type: 'http',
      method: req.method,
      url: req.originalUrl,
      route: routePath,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      contentLength: res.get('content-length'),
      traceId,
      spanId,
    };

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(durationMs)}ms`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(durationMs)}ms`, logData);
    } else {
      logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(durationMs)}ms`, logData);
    }

    // Record metric
    metricsCollector.recordRequest({
      method: req.method,
      path: routePath,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      timestamp: startDate,
    });

    return originalEnd.apply(this, args);
  } as Response['end'];

  next();
}
