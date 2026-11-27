/**
 * Budgets for the nightly CSV import benchmark.
 *
 * Values can be overridden with environment variables so CI can tighten or
 * relax limits without a code change, but the defaults are enforced by the
 * benchmark test itself.
 */
export interface ImportBudgets {
  maxElapsedMs: number;
  maxHeapDeltaBytes: number;
}

export const DEFAULT_IMPORT_BUDGETS: ImportBudgets = {
  // Wall-clock ceiling for parsing + validating + storing 10k rows with
  // database/agent collaborators mocked out (~11.6s on the reference runner).
  maxElapsedMs: 30_000,
  // Peak additional V8 heap retained while processing the fixture
  // (~27MB on the reference runner).
  maxHeapDeltaBytes: 256 * 1024 * 1024,
};

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readImportBudgets(env: NodeJS.ProcessEnv = process.env): ImportBudgets {
  return {
    maxElapsedMs: readPositiveInt(env.BENCHMARK_MAX_ELAPSED_MS, DEFAULT_IMPORT_BUDGETS.maxElapsedMs),
    maxHeapDeltaBytes: readPositiveInt(
      env.BENCHMARK_MAX_HEAP_DELTA_BYTES,
      DEFAULT_IMPORT_BUDGETS.maxHeapDeltaBytes
    ),
  };
}
