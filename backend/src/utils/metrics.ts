/**
 * Application metrics module.
 *
 * Exports a Prometheus {@link Registry} pre-loaded with HTTP, database, and
 * business-domain metric instruments.  All instruments are registered under the
 * shared `register` singleton so they can be scraped from a single `/metrics`
 * endpoint.
 *
 * Default Node.js process metrics (memory, CPU, event-loop lag, GC) are also
 * collected automatically via `collectDefaultMetrics`.
 */
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

register.setDefaultLabels({
  app: 'payd-backend',
  env: process.env.NODE_ENV || 'development',
});

// Collect default Node.js metrics (memory, CPU, event loop lag, GC, etc.)
collectDefaultMetrics({ register });

// ─── HTTP Metrics ────────────────────────────────────────────────────────────

/** Histogram tracking the latency (seconds) of each inbound HTTP request, labelled by method, route, and status code. */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/** Counter tracking the total number of inbound HTTP requests, labelled by method, route, and status code. */
export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/** Counter tracking requests that resulted in a 4xx or 5xx response, labelled by method, route, and status code. */
export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP requests that resulted in an error (4xx/5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/** Gauge reflecting the current number of open HTTP connections to the server. */
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Current number of active HTTP connections',
  registers: [register],
});

// ─── Database Metrics ────────────────────────────────────────────────────────

/** Histogram tracking the latency (seconds) of each PostgreSQL query, labelled by operation and table. */
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of PostgreSQL queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

/**
 * Gauge tracking the current size of the PostgreSQL connection pool.
 * The `state` label distinguishes `'idle'`, `'waiting'`, and `'total'` connections.
 */
export const dbConnectionPool = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Current number of database connections in the pool',
  labelNames: ['state'], // 'idle' | 'waiting' | 'total'
  registers: [register],
});

// ─── Business / Domain Metrics ───────────────────────────────────────────────

/**
 * Counter tracking total payment operations.
 * The `status` label accepts `'success'`, `'failed'`, or `'pending'`.
 * The `type` label accepts `'payroll'`, `'bonus'`, or `'transfer'`.
 */
export const paymentOperations = new Counter({
  name: 'payment_operations_total',
  help: 'Total number of payment operations processed',
  labelNames: ['status', 'type'], // status: success|failed|pending, type: payroll|bonus|transfer
  registers: [register],
});

/** Histogram tracking the wall-clock duration (seconds) of payroll processing jobs, labelled by final status. */
export const payrollJobDuration = new Histogram({
  name: 'payroll_job_duration_seconds',
  help: 'Duration of payroll processing jobs in seconds',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Counter tracking authentication attempts.
 * The `method` label accepts `'jwt'`, `'google'`, or `'github'`.
 * The `status` label accepts `'success'` or `'failure'`.
 */
export const authAttempts = new Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['method', 'status'], // method: jwt|google|github, status: success|failure
  registers: [register],
});

/** Histogram tracking the latency (seconds) of Stellar Horizon / SDS API calls, labelled by operation and status. */
export const stellarApiDuration = new Histogram({
  name: 'stellar_api_duration_seconds',
  help: 'Duration of Stellar Horizon/SDS API calls in seconds',
  labelNames: ['operation', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/** Counter tracking unhandled application errors, labelled by error type and originating route. */
export const errorTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'route'],
  registers: [register],
});

// ─── Queue / Worker Metrics ──────────────────────────────────────────────────

/** Gauge tracking the current depth of BullMQ job queues. */
export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Current number of jobs waiting in each BullMQ queue',
  labelNames: ['queue_name'],
  registers: [register],
});

/** Counter tracking jobs processed by BullMQ workers, labelled by queue and status. */
export const jobsProcessed = new Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed by workers',
  labelNames: ['queue_name', 'status'],
  registers: [register],
});

/** Counter tracking cache hits and misses for the Redis cache layer. */
export const cacheOperations = new Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'],
  registers: [register],
});

/** Histogram tracking response payload sizes in bytes. */
export const responseSizeBytes = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP response bodies in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});

/** Gauge tracking the number of active WebSocket connections. */
export const activeWsConnections = new Gauge({
  name: 'active_ws_connections',
  help: 'Current number of active WebSocket connections',
  registers: [register],
});

/** Gauge tracking the event loop lag in milliseconds. */
export const eventLoopLag = new Gauge({
  name: 'event_loop_lag_ms',
  help: 'Event loop lag in milliseconds',
  registers: [register],
});

/** Histogram tracking cache query latencies. */
export const cacheQueryDuration = new Histogram({
  name: 'cache_query_duration_seconds',
  help: 'Duration of cache queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [register],
});

// ─── Active Event Loop Monitoring ────────────────────────────────────────────

const lagCheckInterval = setInterval(() => {
  const start = Date.now();
  setImmediate(() => {
    const lag = Date.now() - start;
    eventLoopLag.set(lag);
  });
}, 5000);

if (lagCheckInterval.unref) {
  lagCheckInterval.unref();
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Wraps an async function and records its execution duration in the
 * {@link dbQueryDuration} histogram.
 *
 * @example
 * ```ts
 * const rows = await timeDbQuery('select', 'employees', () => pool.query(sql));
 * ```
 *
 * @param operation - Database operation label (e.g. `'select'`, `'insert'`)
 * @param table - Target table name (e.g. `'employees'`)
 * @param fn - Async function that executes the query and returns its result
 * @returns The resolved value of `fn`
 * @throws Re-throws any error raised by `fn` after stopping the timer
 */
export async function timeDbQuery<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
): Promise<T> {
  const end = dbQueryDuration.startTimer({ operation, table });
  try {
    const result = await fn();
    end();
    return result;
  } catch (err) {
    end();
    throw err;
  }
}
