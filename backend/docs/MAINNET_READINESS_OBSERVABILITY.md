# Mainnet Readiness Observability

## Distributed tracing

Set `TRACING_ENABLED=true` before starting the backend to enable OpenTelemetry tracing. The backend initializes tracing before Express and PostgreSQL modules load, so HTTP, Express, and `pg` spans can be correlated across request paths. Use `OTLP_ENDPOINT` to point at an OpenTelemetry Collector or Jaeger OTLP/HTTP endpoint, and `TRACE_SAMPLING_RATE` to tune root trace volume.

The bulk payroll batch submission path emits a named `bulk_payments.submit_batch` span with asset code, batch size, and request id attributes. Health and metrics endpoints are excluded from incoming HTTP spans to keep traces focused on user and job traffic.

## Health probes

Use `/healthz` as the liveness probe. It returns quickly without dependency checks.

Use `/readyz` as the readiness probe. It checks critical dependencies and returns `503` while graceful shutdown is active so orchestrators stop routing new traffic before the process exits.

Legacy probe paths remain available at `/health`, `/health/live`, and `/health/ready`.

## Graceful shutdown

On `SIGTERM` or `SIGINT`, the backend marks readiness as unavailable, stops accepting new HTTP connections, waits for in-flight HTTP requests to drain, stops BullMQ workers, closes the database pool, resets rate-limiting/throttling resources, and shuts down tracing.

## Bulk payroll batch load test

The baseline load test lives at `scripts/load-tests/bulk-payments-batch.k6.js`.

Run it against a local backend:

```bash
k6 run backend/scripts/load-tests/bulk-payments-batch.k6.js
```

Useful overrides:

```bash
BASE_URL=https://api.example.com BATCH_SIZE=100 k6 run backend/scripts/load-tests/bulk-payments-batch.k6.js
```

Default thresholds are: failure rate below 1%, p95 latency below 750 ms, p99 below 1500 ms, and batch acceptance above 99%.
