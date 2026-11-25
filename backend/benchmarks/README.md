# CSV import benchmark

A deterministic, fixture-based benchmark for the 10k-row payroll CSV import
path (`csvPayrollImportService` via `bulkImportController`).

## Run locally

```bash
cd backend
npm run test:benchmark:import
```

This does **not** start the API or build the project: database and downstream
collaborators are mocked, so the benchmark only exercises CSV parsing, row
validation and the bulk-store loop.

Regenerate the deterministic fixture with:

```bash
npm run fixture:payroll:10k
```

## Budgets

Budgets are defined in `importBudgets.ts` and enforced by assertions in
`__tests__/csvImport.benchmark.test.ts`:

| Budget | Default | Env override |
| --- | --- | --- |
| Wall clock | 30,000 ms | `BENCHMARK_MAX_ELAPSED_MS` |
| Heap delta | 256 MiB | `BENCHMARK_MAX_HEAP_DELTA_BYTES` |

A budget breach fails the Jest run. The measurement JSON is written **before**
assertions so the result is always available, by default to
`artifacts/benchmarks/csv-import-10k.json` (override with
`BENCHMARK_ARTIFACT_PATH`). The nightly GitHub Actions workflow uploads that
directory as a build artifact.
