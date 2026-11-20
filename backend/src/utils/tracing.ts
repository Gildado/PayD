/**
 * OpenTelemetry distributed tracing bootstrap.
 *
 * Call {@link initTracing} once at process startup — before importing
 * `express` or `pg` — to enable auto-instrumentation of HTTP, Express,
 * and PostgreSQL spans.
 *
 * Controlled by the `TRACING_ENABLED=true` environment variable.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base';
import { trace, SpanStatusCode, type Attributes } from '@opentelemetry/api';

const serviceName = 'payd-backend';
const serviceVersion = process.env.npm_package_version ?? '1.0.0';
const otlpEndpoint = process.env.OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces';
const tracingEnabled = process.env.TRACING_ENABLED === 'true';
const isDev = process.env.NODE_ENV !== 'production';
const samplingRate = parseFloat(process.env.TRACE_SAMPLING_RATE ?? (isDev ? '1' : '0.1'));

/**
 * The active {@link NodeSDK} instance, or `null` when tracing is disabled.
 * Exposed for graceful-shutdown hooks and test introspection.
 */
let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry distributed tracing.
 *
 * In development the SDK prints spans to stdout (ConsoleSpanExporter).
 * In production (or when OTLP_ENDPOINT is set) spans are exported via OTLP/HTTP
 * to Jaeger (or any compatible collector such as the OpenTelemetry Collector).
 *
 * @example
 * ```ts
 * // At the very top of src/index.ts, before other imports:
 * import { initTracing } from './utils/tracing.js';
 * initTracing();
 * ```
 *
 * @returns `void` — side-effects only (registers span processors and signal handlers)
 */
export function initTracing(): void {
  if (!tracingEnabled || sdk) {
    return;
  }

  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(samplingRate),
  });

  const spanProcessor: SpanProcessor = isDev
    ? new SimpleSpanProcessor(new ConsoleSpanExporter())
    : new BatchSpanProcessor(new OTLPTraceExporter({ url: otlpEndpoint }), {
        maxQueueSize: 1000,
        maxExportBatchSize: 100,
        scheduledDelayMillis: 500,
      });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    spanProcessors: [spanProcessor],
    sampler,
    instrumentations: [
      new HttpInstrumentation({
        // Strip health/metrics endpoints from traces to reduce noise
        ignoreIncomingRequestHook: (req) => {
          const url = req.url ?? '';
          return url === '/health' || url === '/healthz' || url === '/readyz' || url === '/metrics';
        },
        requestHook: (span, request) => {
          span.setAttribute('http.request_id', (request as any).headers?.['x-request-id'] ?? '');
        },
      }),
      new ExpressInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: true }),
    ],
  });

  sdk.start();
}

export function isTracingEnabled(): boolean {
  return tracingEnabled;
}

export function getTracer() {
  return trace.getTracer(serviceName, serviceVersion);
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  operation: () => Promise<T>,
): Promise<T> {
  return getTracer().startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

export { sdk };
