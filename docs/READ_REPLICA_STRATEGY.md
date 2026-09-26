# Read-Replica Strategy for Reporting Queries

Status: proposal (issue #1568). No runtime behavior changes in this document.

## Why

Reporting and export workloads (multi-month payroll/audit aggregations, CSV/PDF
exports, scheduled report agents) scan far more rows than transactional API
calls and hold connections longer. On a single PostgreSQL primary they compete
with payroll execution, SEP-31 flows and webhook delivery for connections and
I/O. At mainnet volume this is the main way a report can degrade a
money-moving request. Offloading read-only reporting to a streaming replica
isolates that load.

## Current state

- One shared `pg` `Pool` (`backend/src/config/database.ts`) built from
  `DATABASE_URL`, with pool sizing and `statement_timeout`/`query_timeout` from
  `getPoolConfig()` in `backend/src/config/env.js`.
- Reporting services (`advancedReportService`, `exportService`,
  `exportJobService`, the `*ReportAgent` services, `scheduledReportDeliveryAgent`,
  `slowQueryTrendReportAgent`) receive or import that same pool, so reports and
  writes share connections.
- Pool utilisation is already exported via the `dbConnectionPool` metric and
  query latency via `dbQueryDuration`, which gives us the baseline needed to
  validate the change.

## Proposal

### 1. Configuration

- Add an optional `DATABASE_REPLICA_URL` (validated alongside `DATABASE_URL` in
  `config/env`). When unset, behavior is identical to today.
- Add a second pool, `replicaPool`, exported next to `pool` in
  `config/database.ts`, with its own sizing (`DB_REPLICA_POOL_MAX`, default
  smaller than the primary) and a stricter `statement_timeout` suited to
  reporting.
- Expose a single helper, `getReadPool()`, returning `replicaPool` when
  configured and healthy, else `pool`. Reporting code calls this instead of
  importing `pool` directly.

### 2. What routes to the replica

Route to replica (read-only, tolerant of seconds of staleness):

- Aggregate/analytics reports and all `*ReportAgent` services.
- CSV/PDF export generation and `exportJobService` batch reads.
- Scheduled report delivery.
- Slow-query trend and other operational reporting.

Always stay on the primary:

- Anything inside a transaction or that follows a write in the same request
  (read-your-writes), including payroll execution and approval flows.
- Balance, escrow, and authorization checks that gate a payment.
- Audit-trail writes and any read used to make a compliance decision in real
  time.
- Idempotency-key and nonce lookups.

Rule of thumb: if a stale answer could cause money to move incorrectly, it does
not use the replica.

### 3. Consistency and lag

- Replication is asynchronous, so a report may lag the primary. Reports must
  show an "as of" timestamp; `reportFreshnessService` is the natural place to
  record replica lag alongside data freshness.
- Before serving a report, check replay lag
  (`now() - pg_last_xact_replay_timestamp()`, or the managed provider's lag
  metric). If lag exceeds a threshold (proposed default 30s, configurable via
  `DB_REPLICA_MAX_LAG_SECONDS`), fall back to the primary or return the report
  flagged as stale, depending on report type.
- Scheduled and exported reports that must include "everything up to a cutoff"
  should take the cutoff at request time and wait for the replica to pass it, or
  run on the primary.

### 4. Failure handling

- If the replica is unreachable or over the lag threshold, `getReadPool()` falls
  back to the primary and emits a warning metric; reporting concurrency on the
  primary is capped (`DB_FALLBACK_REPORT_CONCURRENCY`) so fallback cannot starve
  payment traffic.
- Circuit-break the replica after N consecutive failures and re-probe on an
  interval rather than checking per query.
- Replica connection errors must never fail a payment path; only reporting is
  affected.

### 5. Security

- Use a dedicated read-only database role for the replica connection so a bug in
  reporting code cannot write, even if pointed at the wrong pool.
- Same TLS requirements as the primary; the URL is a secret and belongs in the
  same secret store as `DATABASE_URL`.
- Tenant/org scoping in report queries (`reportAccessControl`) is unchanged; the
  replica holds the same data and must not become a way around it.

### 6. Observability

- Add `pool` label (`primary`/`replica`) to `dbConnectionPool` and
  `dbQueryDuration`.
- New metrics: replica lag seconds, fallback count, replica error count.
- Alert on sustained lag above threshold and on any fallback spike.

### 7. Rollout

1. Ship `DATABASE_REPLICA_URL`, `replicaPool` and `getReadPool()` with no
   callers (no-op).
2. Move one low-risk report agent to `getReadPool()` in staging; compare
   results and latency against the primary.
3. Move the remaining reporting services in batches, watching primary
   connection utilisation and p95 query time.
4. Enable in production per environment via config only; rollback is unsetting
   `DATABASE_REPLICA_URL`.

## Testing plan

- Unit tests (`backend/src/config/__tests__`): `getReadPool()` returns the
  primary when no replica is configured, the replica when healthy, and the
  primary when lag/health checks fail.
- Service tests: a reporting service uses the read pool; a payment-path service
  never does.
- Regression: no change to any API contract or `openapi.json`, since this is
  internal routing only.

## Risks and open questions

- Managed-provider specifics (RDS/Cloud SQL/Supabase) determine how lag is read
  and whether a replica endpoint is stable across failover.
- Some report agents may issue writes (for example recording their own audit
  rows); those writes must keep using the primary while reads move.
- Cost of an always-on replica versus the current load; capture baseline pool
  metrics first to justify it.
