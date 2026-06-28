import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { Client } from '@elastic/elasticsearch';
import { getRequestId, REQUEST_ID_HEADER } from '../middlewares/requestIdMiddleware.js';

// ElasticsearchTransport's client type lags behind @elastic/elasticsearch v8;
// cast via unknown to avoid declaration-file version conflicts.
type EsClientCompat = Parameters<typeof ElasticsearchTransport>[0]['client'];

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const esEnabled = process.env.ELASTICSEARCH_ENABLED === 'true';
const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

// Inject the async-context request ID into every log entry automatically.
const requestIdFormat = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId) {
    (info as Record<string, unknown>)[REQUEST_ID_HEADER] = requestId;
  }
  return info;
});

// Console format: colorized for dev, JSON for prod
const consoleFormat = isProduction
  ? combine(requestIdFormat(), timestamp(), errors({ stack: true }), json())
  : combine(
      requestIdFormat(),
      colorize({ all: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      printf(({ timestamp: ts, level, message, traceId, ...meta }) => {
        const requestId = (meta as Record<string, unknown>)[REQUEST_ID_HEADER];
        const metaCopy = { ...meta };
        delete (metaCopy as Record<string, unknown>)[REQUEST_ID_HEADER];
        const metaStr = Object.keys(metaCopy).length ? ` ${JSON.stringify(metaCopy)}` : '';
        const traceStr = traceId ? ` [trace:${traceId}]` : '';
        const reqStr = requestId ? ` [req:${requestId}]` : '';
        return `[${ts}] [${level}]${traceStr}${reqStr} ${message}${metaStr}`;
      }),
    );

const transports: winston.transport[] = [
  new winston.transports.Console({ format: consoleFormat }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: combine(requestIdFormat(), timestamp(), errors({ stack: true }), json()),
    maxsize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: combine(requestIdFormat(), timestamp(), errors({ stack: true }), json()),
    maxsize: 20 * 1024 * 1024, // 20 MB
    maxFiles: 10,
  }),
];

// Elasticsearch transport — added when ELASTICSEARCH_ENABLED=true
if (esEnabled) {
  const esClient = new Client({ node: esUrl });
  const esTransport = new ElasticsearchTransport({
    level: 'info',
    client: esClient as unknown as EsClientCompat,
    indexPrefix: 'payd-logs',
    indexSuffixPattern: 'YYYY.MM.DD',
    transformer: (logData: winston.Logform.TransformableInfo) => ({
      '@timestamp': new Date().toISOString(),
      severity: logData.level,
      message: logData.message,
      service: 'payd-backend',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      ...(typeof logData.meta === 'object' && logData.meta !== null ? logData.meta : {}),
    }),
  });

  esTransport.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Elasticsearch transport error:', err.message);
  });

  transports.push(esTransport);
}

const winstonLogger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'payd-backend' },
  transports,
  exitOnError: false,
});

/**
 * Singleton structured logger with leveled logging (DEBUG, INFO, WARN, ERROR).
 * Backed by Winston with console, file-rotation, and optional Elasticsearch transports.
 * Automatically attaches the async-context request ID to every log entry.
 */
export class Logger {
  private static instance: Logger;

  private constructor() {}

  /**
   * Gets the singleton logger instance (creates if not exists).
   *
   * @param _level - Accepted for backward compatibility; level is set via LOG_LEVEL env var.
   * @returns The logger instance
   */
  static getInstance(_level?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Logs a debug-level message. Useful for verbose diagnostic information.
   *
   * @param message - Human-readable log message
   * @param data - Optional structured metadata to attach to the log entry
   */
  debug(message: string, data?: Record<string, unknown>): void {
    winstonLogger.debug(message, data);
  }

  /**
   * Logs an informational message for normal application events.
   *
   * @param message - Human-readable log message
   * @param data - Optional structured metadata to attach to the log entry
   */
  info(message: string, data?: Record<string, unknown>): void {
    winstonLogger.info(message, data);
  }

  /**
   * Logs a warning message for non-critical unexpected conditions.
   *
   * @param message - Human-readable log message
   * @param data - Optional structured metadata to attach to the log entry
   */
  warn(message: string, data?: Record<string, unknown>): void {
    winstonLogger.warn(message, data);
  }

  /**
   * Logs an error-level message. Accepts a raw `Error` object and automatically
   * extracts `message` and `stack` into the log metadata.
   *
   * @param message - Human-readable description of the error context
   * @param error - Optional error value; `Error` instances are serialised automatically
   */
  error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      winstonLogger.error(message, { error: error.message, stack: error.stack });
    } else {
      winstonLogger.error(message, { error });
    }
  }

  /**
   * Returns a child logger with additional bound metadata (e.g. `traceId`, `userId`).
   * All entries written through the child automatically include the bound fields.
   *
   * @param meta - Key/value pairs to bind permanently to the child logger
   * @returns A Winston child logger instance
   */
  child(meta: Record<string, unknown>): winston.Logger {
    return winstonLogger.child(meta);
  }
}

export { winstonLogger };
export default Logger.getInstance();
