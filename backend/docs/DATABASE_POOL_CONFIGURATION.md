# Database Connection Pool Configuration

This document describes how to tune the PostgreSQL connection pool for PayD's mainnet deployment.

## Overview

The connection pool is configured via environment variables in `src/config/env.ts`. The pool manages connections between the application and PostgreSQL, balancing resource usage with performance.

## Configuration Parameters

### `DB_POOL_MIN` (default: 2)
Minimum number of connections to maintain in the pool.

- Development: 2-5
- Staging: 5-10
- Production (mainnet): 10-20

### `DB_POOL_MAX` (default: 20)
Maximum number of connections to allow in the pool.

- Development: 10-20
- Staging: 20-50
- Production (mainnet): 50-100

The actual max depends on:
- PostgreSQL `max_connections` setting
- Total connections = (pool max) × (number of app instances)

For mainnet with 3 instances: 3 × 100 = 300 connections.
Ensure PostgreSQL has `max_connections >= 400` (accounting for other services).

### `DB_IDLE_TIMEOUT_MS` (default: 30000)
Time in milliseconds before an idle connection is closed.

- Development: 30000 (30 seconds)
- Production: 60000 (1 minute)

Shorter timeouts reduce resource usage; longer ones avoid re-opening connections.

### `DB_CONNECTION_TIMEOUT_MS` (default: 5000)
Time in milliseconds to wait for a new connection before timing out.

- Critical for preventing queue buildup under load
- Default 5000 ms is appropriate for mainnet
- Do not reduce below 2000 ms

### `DB_STATEMENT_TIMEOUT_MS` (default: 30000)
Time in milliseconds before a database statement is forcibly terminated.

- Prevents runaway queries from holding connections
- Set to the expected query latency + 5 seconds
- For mainnet: 30000 ms (30 seconds)

### `DB_QUERY_TIMEOUT_MS` (default: 30000)
Time in milliseconds before a raw query execution is abandoned.

- Same value as `DB_STATEMENT_TIMEOUT_MS` recommended
- Ensures consistency

## Mainnet Configuration

For mainnet launch, use these settings:

```bash
DB_POOL_MIN=15
DB_POOL_MAX=75
DB_IDLE_TIMEOUT_MS=60000
DB_CONNECTION_TIMEOUT_MS=5000
DB_STATEMENT_TIMEOUT_MS=30000
DB_QUERY_TIMEOUT_MS=30000
```

### Calculation Rationale

- **Min 15**: Maintains baseline connections to handle spikes without immediate new connection overhead
- **Max 75**: Per instance; total 225 for 3-instance cluster, leaving headroom in PostgreSQL
- **Idle timeout 60s**: Balances resource usage and connection reuse under variable load
- **Connection timeout 5s**: Matches typical request latency expectations

## Monitoring

Monitor these metrics:
- `db_connection_pool_total`: Total connections in pool
- `db_connection_pool_idle`: Idle connections available
- `db_connection_pool_waiting`: Requests waiting for a connection

Alert thresholds:
- `db_connection_pool_waiting > 5` for more than 1 minute = increase pool size
- `db_connection_pool_idle / db_connection_pool_total < 0.2` for more than 1 minute = increase pool size

## Testing Pool Configuration

After deployment, monitor under realistic load:

1. Run load tests targeting 100 concurrent users
2. Monitor connection pool metrics
3. Verify query response times remain <500ms p95
4. Check for connection timeout errors in logs
5. Verify no statement timeouts under normal load

## Tuning Process

If performance degrades:

1. **Connection timeouts**: Increase `DB_POOL_MAX` by 25%
2. **Query timeouts**: Identify slow queries with `EXPLAIN ANALYZE`
3. **Idle connections**: Decrease `DB_IDLE_TIMEOUT_MS` by 50%
4. **Spike handling**: Increase `DB_POOL_MIN` by 5-10 connections

## References

- PostgreSQL documentation: https://www.postgresql.org/docs/current/runtime-config-connection.html
- pg module (Node.js driver): https://node-postgres.com/apis/pool
