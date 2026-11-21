import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

jest.mock('../../config/database', () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn(),
  },
}));

jest.mock('../../services/employeeService', () => ({
  employeeService: {
    create: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/csvImportAnomalyDetectionAgent', () => ({
  csvImportAnomalyDetectionAgent: {
    evaluateImport: jest.fn().mockResolvedValue(undefined),
  },
}));

import { csvPayrollImportService } from '../../services/csvPayrollImportService.js';
import { pool } from '../../config/database.js';
import { employeeService } from '../../services/employeeService.js';
import { readImportBudgets } from '../importBudgets.js';
import { writeBenchmarkResult } from '../benchmarkArtifact.js';

const FIXTURE_PATH = resolve(__dirname, '../fixtures/payroll-10k.csv');
const ORGANIZATION_ID = 42;
const EXPECTED_ROWS = 10_000;

describe('CSV payroll import benchmark (10k rows)', () => {
  it(
    'parses, validates and stores 10k fixture rows within the time and memory budgets',
    async () => {
      const csvContent = readFileSync(FIXTURE_PATH, 'utf8');
      const rowCount = csvContent.trim().split('\n').length - 1; // minus header

      expect(rowCount).toBe(EXPECTED_ROWS);

      const mockClient = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);
      (employeeService.create as jest.Mock).mockResolvedValue(undefined);

      const budgets = readImportBudgets();
      const collectGarbage = (global as typeof globalThis & { gc?: () => void }).gc;
      if (collectGarbage) collectGarbage();
      const before = process.memoryUsage();

      const startedAt = process.hrtime.bigint();
      const result = await csvPayrollImportService.processCsv(ORGANIZATION_ID, csvContent);
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      const after = process.memoryUsage();
      const estimatedHeapDeltaBytes = after.heapUsed - before.heapUsed;
      const rssDeltaBytes = after.rss - before.rss;

      const violations: string[] = [];
      if (elapsedMs > budgets.maxElapsedMs) {
        violations.push(
          `elapsed ${elapsedMs.toFixed(1)}ms exceeds budget ${budgets.maxElapsedMs}ms`
        );
      }
      if (estimatedHeapDeltaBytes > budgets.maxHeapDeltaBytes) {
        violations.push(
          `heap delta ${estimatedHeapDeltaBytes} bytes exceeds budget ${budgets.maxHeapDeltaBytes} bytes`
        );
      }

      // Persist the result BEFORE asserting so CI always has an artifact,
      // including on a budget violation.
      const artifactPath = writeBenchmarkResult({
        benchmark: 'csv-import-10k',
        generatedAt: new Date().toISOString(),
        gitSha: process.env.GITHUB_SHA ?? null,
        node: process.version,
        platform: process.platform,
        rowCount,
        budgets,
        measurements: {
          elapsedMs: Number(elapsedMs.toFixed(2)),
          estimatedHeapDeltaBytes,
          rssDeltaBytes,
          successCount: result.successCount,
          errorCount: result.errorCount,
        },
        passed: violations.length === 0,
        violations,
      });

      // eslint-disable-next-line no-console
      console.log(
        `[benchmark] csv-import-10k: ${elapsedMs.toFixed(1)}ms, ` +
          `heap delta ${(estimatedHeapDeltaBytes / 1024 / 1024).toFixed(1)}MB, ` +
          `artifact ${artifactPath}`
      );

      expect(result.totalRows).toBe(EXPECTED_ROWS);
      expect(result.successCount).toBe(EXPECTED_ROWS);
      expect(result.errorCount).toBe(0);
      expect(employeeService.create).toHaveBeenCalledTimes(EXPECTED_ROWS);
      expect(violations).toEqual([]);
    },
    120_000
  );
});
