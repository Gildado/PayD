import type { Request, Response, NextFunction } from 'express';
import { winstonLogger } from '../utils/logger.js';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestErrors,
  activeConnections,
  errorTotal,
} from '../utils/metrics.js';
import { buildRequestMetricLabels, matchedRoutePattern } from '../utils/metricLabels.js';

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
    const labels = buildRequestMetricLabels(req, statusCode);
    const route = labels.route;
    const method = labels.method;

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
      url: route,
      route,
      tenant: labels.tenant,
      user: labels.user,
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
  const route = matchedRoutePattern(req);

  errorTotal.inc({ type: 'unhandled_error', route });

  winstonLogger.error('Unhandled application error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: route,
    route,
  });

  next(err);
}
