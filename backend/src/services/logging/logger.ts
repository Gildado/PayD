import winston from 'winston';
import { createTransports } from './transports';
import { monitoringConfig } from '../../config/monitoring';

/**
 * Centralized Logger for PayD Backend
 *
 * Provides structured JSON logging with:
 * - Multiple transports (console, file, Elasticsearch)
 * - Distributed tracing context (traceId, spanId)
 * - Environment-aware log levels
 * - Child logger support for service-scoped logging
 */

// ─── Logger Instance ──────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: monitoringConfig.LOG_LEVEL,
  defaultMeta: {
    service: monitoringConfig.SERVICE_NAME,
    version: monitoringConfig.SERVICE_VERSION,
    environment: process.env.NODE_ENV || 'development',
  },
  transports: createTransports(),
  exitOnError: false,
});

// ─── Child Logger Factory ─────────────────────────────────────────────────────

/**
 * Creates a child logger with additional default metadata.
 * Useful for scoping logs to a specific module or service.
 *
 * @example
 * const dbLogger = createChildLogger({ module: 'database' });
 * dbLogger.info('Connection established');
 */
export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}

// ─── Contextual Logging Helpers ───────────────────────────────────────────────

/**
 * Log with distributed tracing context.
 */
export function logWithTrace(
  level: string,
  message: string,
  traceId: string,
  spanId: string,
  meta?: Record<string, unknown>,
): void {
  logger.log(level, message, { traceId, spanId, ...meta });
}

/**
 * Log a performance metric.
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  meta?: Record<string, unknown>,
): void {
  logger.info('Performance metric', {
    type: 'performance',
    operation,
    durationMs,
    ...meta,
  });
}

/**
 * Log a transaction event for Stellar operations.
 */
export function logTransaction(
  action: string,
  txHash: string,
  meta?: Record<string, unknown>,
): void {
  logger.info('Transaction event', {
    type: 'transaction',
    action,
    txHash,
    ...meta,
  });
}

/**
 * Log a security event (auth failures, suspicious activity).
 */
export function logSecurity(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  meta?: Record<string, unknown>,
): void {
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  logger.log(level, `Security: ${event}`, {
    type: 'security',
    securityEvent: event,
    severity,
    ...meta,
  });
}

/**
 * Log a database operation.
 */
export function logDatabase(
  operation: string,
  durationMs: number,
  meta?: Record<string, unknown>,
): void {
  logger.debug('Database operation', {
    type: 'database',
    operation,
    durationMs,
    ...meta,
  });
}

export default logger;
