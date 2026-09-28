import type { Request, Response, NextFunction } from 'express';
import { winstonLogger } from '../utils/logger.js';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestErrors,
  activeConnections,
  errorTotal,
} from '../utils/metrics.js';

/**
 * Normalize express route paths so metric cardinality stays low.
 * e.g. /api/employees/42/payroll → /api/employees/:id/payroll
 */
function normalizeRoute(req: Request): string {
  return req.route?.path
    ? `${req.baseUrl ?? ''}${req.route.path}`
    : req.path.replace(/\/[0-9a-f-]{8,}/gi, '/:id');
}

/**
 * Structured HTTP request/response logging + Prometheus metrics middleware.
 * Replaces morgan for JSON-structured output compatible with the ELK pipeline.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  activeConnections.inc();

  // Extract OpenTelemetry trace context if present
  const traceId = (req.headers['x-trace-id'] as string | undefined) ?? undefined;

  res.on('finish', () => {
    activeConnections.dec();

    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const statusCode = res.statusCode;
    const route = normalizeRoute(req);
    const method = req.method;
    const labels = { method, route, status_code: String(statusCode) };

    httpRequestDuration.observe(labels, durationSec);
    httpRequestTotal.inc(labels);

    if (statusCode >= 400) {
      httpRequestErrors.inc(labels);
      if (statusCode >= 500) {
        errorTotal.inc({ type: 'http_server_error', route });
      }
    }

    const logPayload: Record<string, unknown> = {
      method,
      url: req.originalUrl,
      route,
      status: statusCode,
      duration_ms: durationMs,
      ip: req.ip,
      user_agent: req.get('user-agent'),
      content_length: res.get('content-length'),
      ...(traceId ? { traceId } : {}),
    };

    if (statusCode >= 500) {
      winstonLogger.error('HTTP request error', logPayload);
    } else if (statusCode >= 400) {
      winstonLogger.warn('HTTP request warning', logPayload);
    } else {
      winstonLogger.info('HTTP request', logPayload);
    }
  });

  next();
}

/**
 * Global error-handler middleware — logs unhandled errors with full stack trace
 * and increments the error counter.
 */
export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const route = normalizeRoute(req);

  errorTotal.inc({ type: 'unhandled_error', route });

  winstonLogger.error('Unhandled application error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    route,
  });

  next(err);
}
