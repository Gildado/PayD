/**
 * Tests for VestingScheduleProjectionReportAgent
 *
 * Uses a mock pg Pool — no real database connection required.
 */

import { jest, describe, it, expect } from '@jest/globals';
import { VestingScheduleProjectionReportAgent } from '../vestingScheduleProjectionReportAgent.js';
import type { Pool } from 'pg';
import {
  FIXTURE_EXPECTED,
  FIXTURE_ORG_ID,
} from './fixtures/vestingScheduleProjectionFixture.js';

function makePool(resolvedRows: unknown[][]): Pool {
  const chain = resolvedRows.reduceRight(
    (prev, rows) => jest.fn().mockResolvedValueOnce({ rows }).mockReturnValue(prev),
    jest.fn().mockResolvedValue({ rows: [] }),
  );
  return { query: chain } as unknown as Pool;
}

describe('VestingScheduleProjectionReportAgent', () => {
  describe('execute()', () => {
    it('throws when organizationId is missing', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new VestingScheduleProjectionReportAgent(pool);
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
    });

    it('returns correct summary with vesting totals', async () => {
      const summaryRows = [{
        total_active_grants: FIXTURE_EXPECTED.totalActiveGrants,
        total_granted: FIXTURE_EXPECTED.totalGrantedAmount,
        total_vested: FIXTURE_EXPECTED.totalVestedAmount,
        total_claimed: FIXTURE_EXPECTED.totalClaimedAmount,
        total_unvested: FIXTURE_EXPECTED.totalUnvestedAmount,
      }];
      const upcoming30Rows = [{
        grant_count: FIXTURE_EXPECTED.upcomingReleases30Days,
        total_amount: FIXTURE_EXPECTED.upcomingAmount30Days,
      }];
      const releasesRows: unknown[] = [];
      const employeeRows: unknown[] = [];
      const projectionRows: unknown[] = [];

      const pool = makePool([summaryRows, upcoming30Rows, releasesRows, employeeRows, projectionRows]);
      const agent = new VestingScheduleProjectionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as any;
      expect(report.schemaVersion).toBe('1.0');
      expect(report.summary.totalActiveGrants).toBe(FIXTURE_EXPECTED.totalActiveGrants);
      expect(report.summary.totalGrantedAmount).toBe(FIXTURE_EXPECTED.totalGrantedAmount);
      expect(report.summary.totalVestedAmount).toBe(FIXTURE_EXPECTED.totalVestedAmount);
      expect(report.summary.totalClaimedAmount).toBe(FIXTURE_EXPECTED.totalClaimedAmount);
      expect(report.summary.totalUnvestedAmount).toBe(FIXTURE_EXPECTED.totalUnvestedAmount);
      expect(report.summary.upcomingReleases30Days).toBe(FIXTURE_EXPECTED.upcomingReleases30Days);
      expect(report.summary.upcomingAmount30Days).toBe(FIXTURE_EXPECTED.upcomingAmount30Days);
    });

    it('includes upcoming releases grouped by date', async () => {
      const summaryRows = [{ total_active_grants: 4, total_granted: 350000, total_vested: 140000, total_claimed: 120000, total_unvested: 210000 }];
      const upcoming30Rows = [{ grant_count: 2, total_amount: 18000 }];
      const releasesRows = [
        { release_date: new Date('2024-03-22'), grant_count: 2, total_amount: 18000, employee_ids: [1, 2] },
        { release_date: new Date('2024-04-15'), grant_count: 1, total_amount: 5000, employee_ids: [1] },
      ];
      const employeeRows: unknown[] = [];
      const projectionRows: unknown[] = [];

      const pool = makePool([summaryRows, upcoming30Rows, releasesRows, employeeRows, projectionRows]);
      const agent = new VestingScheduleProjectionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.upcomingReleases).toHaveLength(2);
      expect(report.upcomingReleases[0].releaseDate).toBe('2024-03-22');
      expect(report.upcomingReleases[0].totalAmount).toBe(18000);
      expect(report.upcomingReleases[0].numberOfGrants).toBe(2);
    });

    it('includes per-employee breakdown', async () => {
      const summaryRows = [{ total_active_grants: 4, total_granted: 350000, total_vested: 140000, total_claimed: 120000, total_unvested: 210000 }];
      const upcoming30Rows = [{ grant_count: 2, total_amount: 18000 }];
      const releasesRows: unknown[] = [];
      const employeeRows = [
        { employee_id: 1, employee_name: 'Alice A', grant_count: 2, total_granted: 150000, total_vested: 60000, total_claimed: 45000, total_unvested: 90000, next_vesting_date: new Date('2024-03-22'), next_vesting_amount: 10000, avg_vesting_rate: 5000 },
        { employee_id: 2, employee_name: 'Bob B', grant_count: 1, total_granted: 80000, total_vested: 30000, total_claimed: 25000, total_unvested: 50000, next_vesting_date: new Date('2024-03-22'), next_vesting_amount: 8000, avg_vesting_rate: 2500 },
      ];
      const projectionRows: unknown[] = [];

      const pool = makePool([summaryRows, upcoming30Rows, releasesRows, employeeRows, projectionRows]);
      const agent = new VestingScheduleProjectionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.byEmployee).toHaveLength(2);
      expect(report.byEmployee[0].employeeName).toBe('Alice A');
      expect(report.byEmployee[0].totalGranted).toBe(FIXTURE_EXPECTED.alice.totalGranted);
      expect(report.byEmployee[0].totalVested).toBe(FIXTURE_EXPECTED.alice.totalVested);
      expect(report.byEmployee[0].totalUnvested).toBe(FIXTURE_EXPECTED.alice.totalUnvested);
      expect(report.byEmployee[0].nextVestingAmount).toBe(FIXTURE_EXPECTED.alice.nextVestingAmount);
    });

    it('includes monthly projections with cumulative totals', async () => {
      const summaryRows = [{ total_active_grants: 4, total_granted: 350000, total_vested: 140000, total_claimed: 120000, total_unvested: 210000 }];
      const upcoming30Rows = [{ grant_count: 2, total_amount: 18000 }];
      const releasesRows: unknown[] = [];
      const employeeRows: unknown[] = [];
      const projectionRows = [
        { month: '2024-03', grant_count: 2, vesting_amount: 18000 },
        { month: '2024-04', grant_count: 1, vesting_amount: 5000 },
        { month: '2024-05', grant_count: 1, vesting_amount: 12000 },
      ];

      const pool = makePool([summaryRows, upcoming30Rows, releasesRows, employeeRows, projectionRows]);
      const agent = new VestingScheduleProjectionReportAgent(pool);

      const result = await agent.execute({ organizationId: FIXTURE_ORG_ID });
      const report = result.data![0] as any;

      expect(report.projections).toHaveLength(3);
      expect(report.projections[0].month).toBe('2024-03');
      expect(report.projections[0].vestingAmount).toBe(18000);
      // Cumulative should increase
      expect(report.projections[0].cumulativeVested).toBe(140000 + 18000);
      expect(report.projections[1].cumulativeVested).toBe(140000 + 18000 + 5000);
    });

    it('applies employee filter when provided', async () => {
      const pool = makePool([[], [], [], [], []]);
      const agent = new VestingScheduleProjectionReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        employeeId: 1,
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('v.employee_id = $3');
    });

    it('applies futureMonths parameter when provided', async () => {
      const pool = makePool([[], [], [], [], []]);
      const agent = new VestingScheduleProjectionReportAgent(pool);

      await agent.execute({
        organizationId: FIXTURE_ORG_ID,
        futureMonths: 6,
      });

      const [sql] = (pool.query as jest.Mock).mock.calls[2];
      expect(sql).toContain("INTERVAL '6 months'");
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const pool = { query: jest.fn() } as unknown as Pool;
      const agent = new VestingScheduleProjectionReportAgent(pool);
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
