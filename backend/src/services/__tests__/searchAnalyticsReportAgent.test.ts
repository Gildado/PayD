/**
 * Tests for SearchAnalyticsReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { SearchAnalyticsReportAgent } from '../searchAnalyticsReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/searchAnalyticsFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('SearchAnalyticsReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new SearchAnalyticsReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary counts', async () => {
      // Query 1: department stats
      const deptRows = [
        { department: 'Engineering', employee_count: 3, avg_salary: '113333.33' },
        { department: 'Sales', employee_count: 2, avg_salary: '87500' },
        { department: 'HR', employee_count: 1, avg_salary: '95000' },
        { department: null, employee_count: 1, avg_salary: '30000' },
      ];
      // Query 2: total counts
      const totalRows = [{
        total_employees: FIXTURE_EXPECTED.totalEmployees,
        active_employees: FIXTURE_EXPECTED.activeEmployees,
        inactive_employees: FIXTURE_EXPECTED.inactiveEmployees,
        total_departments: FIXTURE_EXPECTED.totalDepartments,
        total_positions: FIXTURE_EXPECTED.totalPositions,
      }];
      // Query 3: transaction count
      const txRows = [{ total: FIXTURE_EXPECTED.totalTransactions }];
      // Query 4: department list
      const deptListRows = FIXTURE_EXPECTED.departmentsList.map((d) => ({ department: d }));
      // Query 5: position list
      const posListRows = FIXTURE_EXPECTED.positionsList.map((p) => ({ position: p }));
      // Query 6-N: per-position counts for zero-result check
      const posCountRows = FIXTURE_EXPECTED.positionsList.map((p) => {
        const counts: Record<string, number> = { Dev: 2, Manager: 1, Rep: 2, Lead: 1, Intern: 1 };
        return [{ cnt: counts[p] ?? 1 }];
      });

      const allRows = [deptRows, totalRows, txRows, deptListRows, posListRows, ...posCountRows];
      const pool = makePool(allRows);
      const agent = new SearchAnalyticsReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.totalSearchableEmployees).toBe(FIXTURE_EXPECTED.activeEmployees);
      expect(report.summary.totalSearchableTransactions).toBe(FIXTURE_EXPECTED.totalTransactions);
      expect(report.summary.totalDepartments).toBe(FIXTURE_EXPECTED.totalDepartments);
      expect(report.summary.totalPositions).toBe(FIXTURE_EXPECTED.totalPositions);
    });

    it('returns top departments sorted by employee count', async () => {
      const deptRows = [
        { department: 'Engineering', employee_count: 3, avg_salary: '113333.33' },
        { department: 'Sales', employee_count: 2, avg_salary: '87500' },
      ];
      const totalRows = [{ total_employees: 5, active_employees: 5, inactive_employees: 0, total_departments: 2, total_positions: 3 }];
      const txRows = [{ total: 0 }];
      const deptListRows = [{ department: 'Engineering' }, { department: 'Sales' }];
      const posListRows = [{ position: 'Dev' }];
      // Position count queries (1 per position)
      const posCountRows = [[{ cnt: 5 }]];

      const pool = makePool([deptRows, totalRows, txRows, deptListRows, posListRows, ...posCountRows]);
      const agent = new SearchAnalyticsReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.topDepartments[0].department).toBe('Engineering');
      expect(report.topDepartments[0].employeeCount).toBe(3);
    });

    it('includes search coverage data', async () => {
      const pool = makePool([
        [{ department: 'Eng', employee_count: 1, avg_salary: '100000' }],
        [{ total_employees: 1, active_employees: 1, inactive_employees: 0, total_departments: 1, total_positions: 1 }],
        [{ total: 10 }],
        [{ department: 'Eng' }],
        [{ position: 'Dev' }],
        [{ cnt: 1 }],
      ]);
      const agent = new SearchAnalyticsReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.searchCoverage.totalEmployees).toBe(1);
      expect(report.searchCoverage.totalTransactions).toBe(10);
      expect(report.searchCoverage.departments).toEqual(['Eng']);
      expect(report.searchCoverage.positions).toEqual(['Dev']);
    });

    it('identifies zero-result areas for sparse departments', async () => {
      const deptRows = [
        { department: 'HR', employee_count: 1, avg_salary: '95000' },
      ];
      const totalRows = [{ total_employees: 1, active_employees: 1, inactive_employees: 0, total_departments: 1, total_positions: 1 }];
      const txRows = [{ total: 0 }];
      const deptListRows = [{ department: 'HR' }];
      const posListRows = [{ position: 'Lead' }];
      const posCountRows = [[{ cnt: 1 }]];

      const pool = makePool([deptRows, totalRows, txRows, deptListRows, posListRows, ...posCountRows]);
      const agent = new SearchAnalyticsReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.zeroResultAreas.length).toBeGreaterThanOrEqual(1);
      expect(report.zeroResultAreas[0]).toContain('HR');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new SearchAnalyticsReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
