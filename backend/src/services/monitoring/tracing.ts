import crypto from 'crypto';
import logger from '../logging/logger';
import { monitoringConfig } from '../../config/monitoring';

/**
 * Distributed Tracing Service
 *
 * Provides W3C Trace Context-compatible distributed tracing for
 * tracking complex multi-step operations (e.g. Stellar transactions,
 * payroll batch processing) across the backend.
 *
 * Each trace is identified by a traceId and consists of multiple spans.
 * Spans can be nested to represent parent-child relationships.
 */

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  status: 'ok' | 'error' | 'in_progress';
  tags: Record<string, string | number | boolean>;
  logs: Array<{ timestamp: number; message: string; data?: Record<string, unknown> }>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
}

class TracingService {
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private readonly maxCompletedSpans = 5000;
  private readonly enabled: boolean;
  private readonly sampleRate: number;

  constructor() {
    this.enabled = monitoringConfig.TRACING_ENABLED;
    this.sampleRate = monitoringConfig.TRACING_SAMPLE_RATE;
  }

  /**
   * Generate a new trace ID (128-bit hex string).
   */
  generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a new span ID (64-bit hex string).
   */
  generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Determine if this trace should be sampled based on the configured rate.
   */
  private shouldSample(): boolean {
    if (!this.enabled) return false;
    if (this.sampleRate >= 1.0) return true;
    return Math.random() < this.sampleRate;
  }

  /**
   * Start a new trace (root span).
   */
  startTrace(operationName: string, tags?: Record<string, string | number | boolean>): TraceContext {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    if (this.shouldSample()) {
      const span: Span = {
        spanId,
        traceId,
        parentSpanId: null,
        operationName,
        serviceName: monitoringConfig.SERVICE_NAME,
        startTime: Date.now(),
        endTime: null,
        duration: null,
        status: 'in_progress',
        tags: { ...tags },
        logs: [],
      };

      this.activeSpans.set(spanId, span);

      logger.debug('Trace started', {
        type: 'tracing',
        traceId,
        spanId,
        operationName,
      });
    }

    return { traceId, spanId, parentSpanId: null };
  }

  /**
   * Start a child span within an existing trace.
   */
  startSpan(
    traceId: string,
    parentSpanId: string,
    operationName: string,
    tags?: Record<string, string | number | boolean>,
  ): TraceContext {
    const spanId = this.generateSpanId();

    if (this.enabled) {
      const span: Span = {
        spanId,
        traceId,
        parentSpanId,
        operationName,
        serviceName: monitoringConfig.SERVICE_NAME,
        startTime: Date.now(),
        endTime: null,
        duration: null,
        status: 'in_progress',
        tags: { ...tags },
        logs: [],
      };

      this.activeSpans.set(spanId, span);
    }

    return { traceId, spanId, parentSpanId };
  }

  /**
   * End a span and record its result.
   */
  endSpan(spanId: string, status: 'ok' | 'error' = 'ok', tags?: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (tags) {
      Object.assign(span.tags, tags);
    }

    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);

    // Evict old completed spans
    if (this.completedSpans.length > this.maxCompletedSpans) {
      this.completedSpans = this.completedSpans.slice(-this.maxCompletedSpans / 2);
    }

    logger.debug('Span completed', {
      type: 'tracing',
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      durationMs: span.duration,
      status,
    });

    // Ship span to Elasticsearch if enabled
    if (monitoringConfig.ELASTICSEARCH_ENABLED) {
      this.shipSpan(span);
    }
  }

  /**
   * Add a log entry to an active span.
   */
  addSpanLog(spanId: string, message: string, data?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.logs.push({ timestamp: Date.now(), message, data });
  }

  /**
   * Add tags to an active span.
   */
  addSpanTags(spanId: string, tags: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    Object.assign(span.tags, tags);
  }

  /**
   * Get all spans for a given trace ID.
   */
  getTrace(traceId: string): Span[] {
    const spans = [
      ...Array.from(this.activeSpans.values()).filter((s) => s.traceId === traceId),
      ...this.completedSpans.filter((s) => s.traceId === traceId),
    ];
    return spans.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get recent completed spans.
   */
  getRecentSpans(limit = 50): Span[] {
    return this.completedSpans.slice(-limit).reverse();
  }

  /**
   * Get count of active spans.
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Parse W3C traceparent header to extract trace context.
   * Format: version-traceId-parentId-traceFlags
   */
  parseTraceparent(header: string): TraceContext | null {
    const parts = header.split('-');
    if (parts.length !== 4) return null;

    const [, traceId, parentSpanId] = parts;
    if (!traceId || traceId.length !== 32) return null;
    if (!parentSpanId || parentSpanId.length !== 16) return null;

    return {
      traceId,
      spanId: this.generateSpanId(),
      parentSpanId,
    };
  }

  /**
   * Create a W3C traceparent header value.
   */
  toTraceparent(ctx: TraceContext): string {
    return `00-${ctx.traceId}-${ctx.spanId}-01`;
  }

  /**
   * Ship a completed span to Elasticsearch.
   */
  private async shipSpan(span: Span): Promise<void> {
    try {
      const index = `${monitoringConfig.ELASTICSEARCH_INDEX_PREFIX}-traces-${new Date().toISOString().split('T')[0]}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (monitoringConfig.ELASTICSEARCH_USERNAME && monitoringConfig.ELASTICSEARCH_PASSWORD) {
        headers['Authorization'] =
          'Basic ' +
          Buffer.from(
            `${monitoringConfig.ELASTICSEARCH_USERNAME}:${monitoringConfig.ELASTICSEARCH_PASSWORD}`,
          ).toString('base64');
      }

      await fetch(`${monitoringConfig.ELASTICSEARCH_URL}/${index}/_doc`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...span,
          '@timestamp': new Date(span.startTime).toISOString(),
        }),
      });
    } catch {
      // Silently fail — tracing should not break the application
    }
  }
}

export const tracingService = new TracingService();
export default tracingService;
