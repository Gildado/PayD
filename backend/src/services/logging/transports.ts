import winston from 'winston';
import TransportStream from 'winston-transport';
import { monitoringConfig } from '../../config/monitoring';
import path from 'path';
import fs from 'fs';

/**
 * Custom Winston transports for the PayD logging pipeline.
 *
 * Provides:
 * - Console transport (pretty or JSON)
 * - File transports (error.log, combined.log, rotating by environment)
 * - Elasticsearch transport (ships logs to ELK stack when enabled)
 */

// ─── Formatters ───────────────────────────────────────────────────────────────

const timestampFormat = winston.format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS',
});

const errorStackFormat = winston.format((info) => {
  if (info.error instanceof Error) {
    info.errorStack = info.error.stack;
    info.errorMessage = info.error.message;
  }
  return info;
})();

const serviceMetadata = winston.format((info) => {
  info.service = monitoringConfig.SERVICE_NAME;
  info.version = monitoringConfig.SERVICE_VERSION;
  info.environment = process.env.NODE_ENV || 'development';
  return info;
})();

// ─── Console Transport ────────────────────────────────────────────────────────

function createConsoleTransport(): winston.transport {
  const format =
    monitoringConfig.LOG_FORMAT === 'pretty'
      ? winston.format.combine(
          timestampFormat,
          serviceMetadata,
          errorStackFormat,
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, traceId, spanId, ...meta }) => {
            const trace = traceId ? ` [trace:${traceId}]` : '';
            const span = spanId ? ` [span:${spanId}]` : '';
            const metaStr = Object.keys(meta).length
              ? `\n  ${JSON.stringify(meta, null, 2)}`
              : '';
            return `${timestamp} ${level}${trace}${span}: ${message}${metaStr}`;
          }),
        )
      : winston.format.combine(
          timestampFormat,
          serviceMetadata,
          errorStackFormat,
          winston.format.json(),
        );

  return new winston.transports.Console({
    level: monitoringConfig.LOG_LEVEL,
    format,
  });
}

// ─── File Transports ──────────────────────────────────────────────────────────

function ensureLogDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createFileTransports(): winston.transport[] {
  const logDir = monitoringConfig.LOG_DIR;
  ensureLogDir(logDir);

  const jsonFormat = winston.format.combine(
    timestampFormat,
    serviceMetadata,
    errorStackFormat,
    winston.format.json(),
  );

  return [
    // Error-level logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    // All logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: monitoringConfig.LOG_LEVEL,
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    // HTTP access logs
    new winston.transports.File({
      filename: path.join(logDir, 'access.log'),
      level: 'http',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ];
}

// ─── Elasticsearch Transport ──────────────────────────────────────────────────

/**
 * Custom transport that ships logs to Elasticsearch via its bulk API.
 * Buffers logs and flushes periodically or when the buffer is full.
 */
class ElasticsearchTransport extends TransportStream {
  private buffer: Record<string, unknown>[] = [];
  private readonly bufferLimit = 100;
  private readonly flushInterval: NodeJS.Timeout;
  private readonly esUrl: string;
  private readonly indexPrefix: string;
  private readonly authHeader: string | null;

  constructor(opts: {
    url: string;
    indexPrefix: string;
    username?: string;
    password?: string;
    level?: string;
  }) {
    super({ level: opts.level || 'info' });
    this.esUrl = opts.url;
    this.indexPrefix = opts.indexPrefix;

    if (opts.username && opts.password) {
      this.authHeader =
        'Basic ' + Buffer.from(`${opts.username}:${opts.password}`).toString('base64');
    } else {
      this.authHeader = null;
    }

    // Flush every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
    this.flushInterval.unref();
  }

  log(info: Record<string, unknown>, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const doc = {
      ...info,
      '@timestamp': info.timestamp || new Date().toISOString(),
      index: `${this.indexPrefix}-logs-${new Date().toISOString().split('T')[0]}`,
    };

    this.buffer.push(doc);

    if (this.buffer.length >= this.bufferLimit) {
      this.flush();
    }

    callback();
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const docs = [...this.buffer];
    this.buffer = [];

    try {
      const body = docs
        .map((doc) => {
          const index = (doc.index as string) || `${this.indexPrefix}-logs`;
          const action = JSON.stringify({ index: { _index: index } });
          const source = JSON.stringify(doc);
          return `${action}\n${source}`;
        })
        .join('\n') + '\n';

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-ndjson',
      };

      if (this.authHeader) {
        headers['Authorization'] = this.authHeader;
      }

      const response = await fetch(`${this.esUrl}/_bulk`, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        console.error(`Elasticsearch bulk insert failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Silently drop on connection failure to avoid cascading errors
      console.error('Failed to ship logs to Elasticsearch:', (error as Error).message);
    }
  }

  close(): void {
    clearInterval(this.flushInterval);
    this.flush();
  }
}

// ─── Transport Factory ────────────────────────────────────────────────────────

export function createTransports(): winston.transport[] {
  const transports: winston.transport[] = [createConsoleTransport()];

  // File transports only in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    transports.push(...createFileTransports());
  }

  // Elasticsearch transport when enabled
  if (monitoringConfig.ELASTICSEARCH_ENABLED) {
    transports.push(
      new ElasticsearchTransport({
        url: monitoringConfig.ELASTICSEARCH_URL,
        indexPrefix: monitoringConfig.ELASTICSEARCH_INDEX_PREFIX,
        username: monitoringConfig.ELASTICSEARCH_USERNAME || undefined,
        password: monitoringConfig.ELASTICSEARCH_PASSWORD || undefined,
        level: monitoringConfig.LOG_LEVEL,
      }),
    );
  }

  return transports;
}

export { ElasticsearchTransport };
