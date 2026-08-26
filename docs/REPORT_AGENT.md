# Report Agent Suite

Shared report-agent capabilities covering freshness (#1337), failure alerting with manual-export fallback (#1338), localization (#1339), and performance benchmarking (#1340).

## Backend services (`backend/src/services`)

| Service                     | File                                      | Issue |
| --------------------------- | ----------------------------------------- | ----- |
| Freshness/staleness         | `reportFreshnessService.ts`               | #1337 |
| Failure alerting + fallback | `reportFailureAlertService.ts`            | #1338 |
| Localization (i18n)         | `reportI18nService.ts`                    | #1339 |
| Performance benchmarking    | `reportBenchmarkService.ts`               | #1340 |
| Contract gas/fee cost       | `contractGasFeeReportAgent.ts`            | #1297 |
| Fee estimation accuracy     | `feeEstimationAccuracyReportAgent.ts`     | #1316 |
| Vesting schedule projection | `vestingScheduleProjectionReportAgent.ts` | #1304 |
| Trustline adoption          | `trustlineAdoptionReportAgent.ts`         | #1318 |

All reports emit a stable envelope: `{ success: true, data: <report> }`, where every report payload starts with `schemaVersion`.

## API endpoints (`/api/v1/report-agent`)

Mounted via `backend/src/routes/v1/index.ts`; see `backend/src/routes/reportAgentRoutes.ts`.

### `GET /api/v1/report-agent/freshness`

Query: `organizationPublicKey` (required), optional `startDate` / `endDate`.

Response `data`:

```json
{
  "schemaVersion": "1.0",
  "reportId": "payroll-history",
  "evaluatedAt": "2024-03-01T15:05:00.000Z",
  "lastGeneratedAt": "2024-03-01T15:00:00.000Z",
  "ageMs": 300000,
  "status": "fresh | stale | expired",
  "indicator": {
    "label": "Fresh",
    "tone": "success",
    "description": "Data updated 5m ago."
  },
  "thresholds": { "freshWithinMs": 60000, "staleWithinMs": 86400000 }
}
```

Status rules: age ≤ `freshWithinMs` → `fresh`; ≤ `staleWithinMs` → `stale`; otherwise (or no data) → `expired`. On backend data-source failure the endpoint returns a `manual-export-fallback` payload instead of an opaque error.

### `GET /api/v1/report-agent/i18n?locale=es`

Response `data`: `{ schemaVersion, supportedLocales, messageKeys, locale, labels }` where `labels` maps every well-known report message key to its translated string. Supported locales: `en`, `es`, `fr`.

### `GET /api/v1/report-agent/benchmark?rows=10000&iterations=5`

Benchmarks the standard payroll aggregation over a deterministic synthetic dataset of `rows` transactions (100–1,000,000; default 10,000). Response `data`:

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "...",
  "datasetSize": 10000,
  "budget": { "warnMs": 2000, "failMs": 10000 },
  "verdict": "pass | warn | fail",
  "metrics": {
    "iterations": 5,
    "minMs": 12.3,
    "maxMs": 18.9,
    "meanMs": 14.2,
    "medianMs": 13.7,
    "p95Ms": 18.9,
    "rowsPerSecond": 704225
  }
}
```

Verdict is computed from p95 latency against the warn/fail budgets.

### `GET /api/v1/report-agent/failures`

Returns the current consecutive-failure counters per `reportId[:organizationId]`.

### `GET /api/v1/report-agent/contract-gas-fee`

Query: `organizationId` (required), optional `startDate`, `endDate`, `contractType`.

Tracks and reports on-chain fee cost trends across contract types. Sources data from payroll transactions with fee information. Response includes summary totals, per-contract-type breakdown, time-series trends, and optimization recommendations.

### `GET /api/v1/report-agent/fee-estimation-accuracy`

Query: `organizationId` (required), optional `startDate`, `endDate`, `minDeviation`.

Compares estimated vs actual fees paid to measure estimation accuracy. Response includes accuracy rate, estimation error metrics, distribution buckets (excellent/good/fair/poor), significant deviations, and actionable insights for improving fee estimation.

### `GET /api/v1/report-agent/vesting-schedule-projection`

Query: `organizationId` (required), optional `futureMonths` (default 12), `employeeId`.

Projects upcoming vesting releases across all active schedules. Response includes summary of vested/unvested amounts, upcoming releases grouped by date, per-employee breakdown, and month-by-month projections with cumulative totals.

### `GET /api/v1/report-agent/trustline-adoption`

Query: `organizationId` (required), optional `assetCode`, `department`, `startDate`, `endDate`.

Reports on trustline setup adoption across assets and organizations. Response includes adoption rate metrics, per-asset and per-department breakdowns, recent trustline setups, and recommendations for improving adoption.

## Failure alerting & manual-export fallback (#1338)

`ReportFailureAlertService.executeWithFallback(task, context)` returns either:

- `{ ok: true, source: 'agent', report }`, or
- `{ ok: false, source: 'manual-export-fallback', error, alert, fallback }` where `fallback = { action: 'manual-export', entryPoint: '/reports/custom', instructions }`.

Alerts fire through a pluggable handler once consecutive failures reach the threshold (default 2): `warning` at threshold, `critical` at `2 × threshold`. A success resets the counter.

## UI entry points (`frontend/src/pages/CustomReportBuilder.tsx`)

- **Freshness indicator** (#1337): a badge in the Live Preview header shows `Data: Fresh / Stale / Outdated / No data` derived from preview row timestamps (`frontend/src/services/reportAgentUi.ts`).
- **Failure alert + manual export** (#1338): when a backend export fails, a persistent banner explains the error and offers _Download manual export (CSV)_, which builds the CSV client-side from loaded preview rows.
- **Localized report access** (#1339) and **benchmarking** (#1340) are exposed via the API endpoints above for consumption by dashboards/monitors.

## Tests

Fixture-driven tests live in `backend/src/services/__tests__/` with a known-output dataset in `__tests__/fixtures/reportAgentFixture.ts`:

- `reportFreshnessService.test.ts`
- `reportFailureAlertService.test.ts`
- `reportI18nService.test.ts`
- `reportBenchmarkService.test.ts`

Run: `cd backend && npm test -- src/services/__tests__/reportFreshnessService.test.ts ...`
