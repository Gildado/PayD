import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ImportBudgets } from './importBudgets.js';

export interface BenchmarkResult {
  benchmark: string;
  generatedAt: string;
  gitSha: string | null;
  node: string;
  platform: string;
  rowCount: number;
  budgets: ImportBudgets;
  measurements: {
    elapsedMs: number;
    estimatedHeapDeltaBytes: number;
    rssDeltaBytes: number;
    successCount: number;
    errorCount: number;
  };
  passed: boolean;
  violations: string[];
}

/**
 * Persist benchmark results so CI can upload them as an artifact even when a
 * budget assertion fails. The write happens before assertions in the test.
 */
export function writeBenchmarkResult(result: BenchmarkResult): string {
  const outputPath = resolve(
    process.env.BENCHMARK_ARTIFACT_PATH ??
      resolve(process.cwd(), 'artifacts/benchmarks/csv-import-10k.json')
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return outputPath;
}
