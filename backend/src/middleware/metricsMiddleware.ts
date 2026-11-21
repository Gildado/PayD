import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { buildRequestMetricLabels } from '../utils/metricLabels.js';

/**
 * Structured request performance logging.
 *
 * All values emitted here are safe for use as metric labels: the URL field is
 * the *matched route pattern* (e.g. `/api/employees/:id`) rather than the
 * concrete request URL, and tenant/user identifiers are replaced with opaque,
 * cardinality-capped tokens. Raw IDs never leave this middleware.
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = diff[0] * 1e3 + diff[1] * 1e-6;
    const labels = buildRequestMetricLabels(req, res.statusCode);

    logger.info('Request Performance Metrics', {
      method: labels.method,
      route: labels.route,
      url: labels.route,
      tenant: labels.tenant,
      user: labels.user,
      status: labels.status_code,
      durationMs: durationMs.toFixed(3),
      contentLength: res.get('Content-Length') || 0,
      userAgent: req.get('User-Agent') || 'unknown',
    });

    // Track slow queries/requests
    if (durationMs > 1000) {
      logger.warn('Slow request detected', {
        method: labels.method,
        route: labels.route,
        durationMs: durationMs.toFixed(3),
      });
    }
  });

  next();
};
