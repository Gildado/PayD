/**
 * Tests for EmployeeTurnoverReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { EmployeeTurnoverReportAgent } from '../employeeTurnoverReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/employeeTurnoverFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('EmployeeTurnoverReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new EmployeeTurnoverReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary counts and turnover rate', async () => {
      const activeRows = [{ total: FIXTURE_EXPECTED.totalActive, avg_salary: FIXTURE_EXPECTED.avgBaseSalary }];
      const turnoverRows = [{ total: FIXTURE_EXPECTED.totalTurnedOver, avg_salary: '92500' }];
      const deptRows = [
        { department: 'Engineering', total: 3, active: 2, turned_over: 1, avg_salary: '113333.33' },
        { department: 'Sales', total: 2, active: 1, turned_over: 1, avg_salary: '87500' },
      ];
      const empRows: unknown[] = [];

      const pool = makePool([activeRows, turnoverRows, deptRows, empRows]);
      const agent = new EmployeeTurnoverReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.summary.totalActive).toBe(FIXTURE_EXPECTED.totalActive);
      expect(report.summary.totalTurnedOver).toBe(FIXTURE_EXPECTED.totalTurnedOver);
      expect(report.summary.turnoverRate).toBe(FIXTURE_EXPECTED.turnoverRate);
    });

    it('computes estimated payroll impact', async () => {
      const activeRows = [{ total: 3, avg_salary: '106666.67' }];
      const turnoverRows = [{ total: 2, avg_salary: '92500' }];
      const pool = makePool([activeRows, turnoverRows, [], []]);
      const agent = new EmployeeTurnoverReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      // 2 * 92500 = 185000
      expect(report.summary.estimatedPayrollImpact).toBe(FIXTURE_EXPECTED.estimatedPayrollImpact);
    });

    it('includes per-department breakdown', async () => {
      const activeRows = [{ total: 3, avg_salary: '106666.67' }];
      const turnoverRows = [{ total: 2, avg_salary: '92500' }];
      const deptRows = [
        { department: 'Engineering', total: 3, active: 2, turned_over: 1, avg_salary: '113333.33' },
        { department: 'Sales', total: 2, active: 1, turned_over: 1, avg_salary: '87500' },
      ];
      const pool = makePool([activeRows, turnoverRows, deptRows, []]);
      const agent = new EmployeeTurnoverReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.byDepartment).toHaveLength(2);
      expect(report.byDepartment[0].department).toBe('Engineering');
      expect(report.byDepartment[0].turnoverRate).toBe(FIXTURE_EXPECTED.engineeringTurnoverRate);
    });

    it('lists turned-over employees with tenure', async () => {
      const activeRows = [{ total: 3, avg_salary: '106666.67' }];
      const turnoverRows = [{ total: 1, avg_salary: '100000' }];
      const deptRows: unknown[] = [];
      const empRows = [
        { id: 4, first_name: 'Dave', last_name: 'D', department: 'Engineering', position: 'Dev', base_salary: '100000', base_currency: 'USDC', hire_date: new Date('2023-01-15'), deleted_at: new Date('2024-03-01'), tenure_days: 411 },
      ];
      const pool = makePool([activeRows, turnoverRows, deptRows, empRows]);
      const agent = new EmployeeTurnoverReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.turnedOverEmployees).toHaveLength(1);
      expect(report.turnedOverEmployees[0].firstName).toBe('Dave');
      expect(report.turnedOverEmployees[0].tenureDays).toBe(411);
    });

    it('applies date filters when provided', async () => {
      const pool = makePool([[], [], [], []]);
      const agent = new EmployeeTurnoverReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[1];
      expect(sql).toContain('deleted_at >= $2');
      expect(sql).toContain('deleted_at <= $3');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new EmployeeTurnoverReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
