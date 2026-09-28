/**
 * Vesting Schedule Projection Report Agent (#1304)
 *
 * Projects upcoming vesting releases across all active schedules.
 * Sources data from contracts/vesting_escrow/src/lib.rs and employee vesting records.
 *
 * Output schema:
 *   - summary: totalActiveGrants, totalVestedAmount, totalUnvestedAmount, upcomingReleases
 *   - upcomingReleases: projected vesting releases over the next periods
 *   - byEmployee: per-employee vesting schedule breakdown
 *   - projections: month-by-month vesting projections
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface VestingProjectionFilters {
  organizationId: number;
  futureMonths?: number;
  employeeId?: number;
}

export interface UpcomingRelease {
  releaseDate: string;
  totalAmount: number;
  numberOfGrants: number;
  employeeIds: number[];
}

export interface EmployeeVesting {
  employeeId: number;
  employeeName: string;
  totalGranted: number;
  totalVested: number;
  totalClaimed: number;
  totalUnvested: number;
  nextVestingDate: string | null;
  nextVestingAmount: number;
  grantCount: number;
  avgVestingRate: number;
}

export interface MonthlyProjection {
  month: string;
  vestingAmount: number;
  grantCount: number;
  cumulativeVested: number;
}

export interface VestingScheduleProjectionReport {
  schemaVersion: string;
  summary: {
    totalActiveGrants: number;
    totalGrantedAmount: number;
    totalVestedAmount: number;
    totalClaimedAmount: number;
    totalUnvestedAmount: number;
    upcomingReleases30Days: number;
    upcomingAmount30Days: number;
  };
  upcomingReleases: UpcomingRelease[];
  byEmployee: EmployeeVesting[];
  projections: MonthlyProjection[];
}

export class VestingScheduleProjectionReportAgent implements IReportAgent {
  id = 'vesting-schedule-projection';
  name = 'Vesting Schedule Projection Report';
  description = 'Projects upcoming vesting releases across all active schedules';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as VestingProjectionFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const futureMonths = f?.futureMonths ?? 12;
    const employeeId = f?.employeeId;

    const conditions = ['v.organization_id = $1', 'v.status = $2'];
    const params: any[] = [organizationId, 'active'];
    let paramIndex = 3;

    if (employeeId) {
      conditions.push(`v.employee_id = $${paramIndex}`);
      params.push(employeeId);
      paramIndex++;
    }

    // Summary statistics
    const summaryResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_active_grants,
        COALESCE(SUM(total_amount), 0)::numeric(18,7) AS total_granted,
        COALESCE(SUM(vested_amount), 0)::numeric(18,7) AS total_vested,
        COALESCE(SUM(claimed_amount), 0)::numeric(18,7) AS total_claimed,
        COALESCE(SUM(total_amount - vested_amount), 0)::numeric(18,7) AS total_unvested
      FROM vesting_grants v
      WHERE ${conditions.join(' AND ')}`,
      params
    );

    const totalActiveGrants = summaryResult.rows[0]?.total_active_grants ?? 0;
    const totalGrantedAmount = parseFloat(summaryResult.rows[0]?.total_granted ?? '0');
    const totalVestedAmount = parseFloat(summaryResult.rows[0]?.total_vested ?? '0');
    const totalClaimedAmount = parseFloat(summaryResult.rows[0]?.total_claimed ?? '0');
    const totalUnvestedAmount = parseFloat(summaryResult.rows[0]?.total_unvested ?? '0');

    // Upcoming releases in next 30 days
    const upcoming30Result = await this.pool.query(
      `SELECT
        COUNT(*)::int AS grant_count,
        COALESCE(SUM(next_vesting_amount), 0)::numeric(18,7) AS total_amount
      FROM vesting_grants v
      WHERE ${conditions.join(' AND ')}
        AND next_vesting_date IS NOT NULL
        AND next_vesting_date <= NOW() + INTERVAL '30 days'`,
      params
    );

    const upcomingReleases30Days = upcoming30Result.rows[0]?.grant_count ?? 0;
    const upcomingAmount30Days = parseFloat(upcoming30Result.rows[0]?.total_amount ?? '0');

    // Upcoming releases grouped by date
    const releasesResult = await this.pool.query(
      `SELECT
        DATE(next_vesting_date) AS release_date,
        COUNT(*)::int AS grant_count,
        COALESCE(SUM(next_vesting_amount), 0)::numeric(18,7) AS total_amount,
        array_agg(employee_id) AS employee_ids
      FROM vesting_grants v
      WHERE ${conditions.join(' AND ')}
        AND next_vesting_date IS NOT NULL
        AND next_vesting_date <= NOW() + INTERVAL '${futureMonths} months'
      GROUP BY DATE(next_vesting_date)
      ORDER BY release_date ASC
      LIMIT 50`,
      params
    );

    const upcomingReleases: UpcomingRelease[] = releasesResult.rows.map((row) => ({
      releaseDate: row.release_date.toISOString().split('T')[0],
      totalAmount: parseFloat(row.total_amount),
      numberOfGrants: row.grant_count,
      employeeIds: row.employee_ids,
    }));

    // By employee breakdown
    const employeeResult = await this.pool.query(
      `SELECT
        v.employee_id,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
        COUNT(*)::int AS grant_count,
        COALESCE(SUM(v.total_amount), 0)::numeric(18,7) AS total_granted,
        COALESCE(SUM(v.vested_amount), 0)::numeric(18,7) AS total_vested,
        COALESCE(SUM(v.claimed_amount), 0)::numeric(18,7) AS total_claimed,
        COALESCE(SUM(v.total_amount - v.vested_amount), 0)::numeric(18,7) AS total_unvested,
        MIN(v.next_vesting_date) AS next_vesting_date,
        COALESCE(SUM(CASE WHEN v.next_vesting_date = (
          SELECT MIN(next_vesting_date)
          FROM vesting_grants
          WHERE employee_id = v.employee_id AND next_vesting_date IS NOT NULL
        ) THEN v.next_vesting_amount ELSE 0 END), 0)::numeric(18,7) AS next_vesting_amount,
        CASE
          WHEN SUM(v.total_amount) > 0 THEN
            (SUM(v.vested_amount) * 12.0 / NULLIF(EXTRACT(EPOCH FROM (NOW() - MIN(v.start_date))) / 2628000, 0))::numeric(18,2)
          ELSE 0
        END AS avg_vesting_rate
      FROM vesting_grants v
      JOIN employees e ON e.id = v.employee_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY v.employee_id, e.first_name, e.last_name
      ORDER BY total_unvested DESC`,
      params
    );

    const byEmployee: EmployeeVesting[] = employeeResult.rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      totalGranted: parseFloat(row.total_granted),
      totalVested: parseFloat(row.total_vested),
      totalClaimed: parseFloat(row.total_claimed),
      totalUnvested: parseFloat(row.total_unvested),
      nextVestingDate: row.next_vesting_date ? row.next_vesting_date.toISOString().split('T')[0] : null,
      nextVestingAmount: parseFloat(row.next_vesting_amount ?? '0'),
      grantCount: row.grant_count,
      avgVestingRate: parseFloat(row.avg_vesting_rate ?? '0'),
    }));

    // Monthly projections
    const projectionResult = await this.pool.query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', next_vesting_date), 'YYYY-MM') AS month,
        COUNT(*)::int AS grant_count,
        COALESCE(SUM(next_vesting_amount), 0)::numeric(18,7) AS vesting_amount
      FROM vesting_grants v
      WHERE ${conditions.join(' AND ')}
        AND next_vesting_date IS NOT NULL
        AND next_vesting_date <= NOW() + INTERVAL '${futureMonths} months'
      GROUP BY DATE_TRUNC('month', next_vesting_date)
      ORDER BY month ASC`,
      params
    );

    let cumulativeVested = totalVestedAmount;
    const projections: MonthlyProjection[] = projectionResult.rows.map((row) => {
      cumulativeVested += parseFloat(row.vesting_amount);
      return {
        month: row.month,
        vestingAmount: parseFloat(row.vesting_amount),
        grantCount: row.grant_count,
        cumulativeVested: cumulativeVested,
      };
    });

    const report: VestingScheduleProjectionReport = {
      schemaVersion: '1.0',
      summary: {
        totalActiveGrants,
        totalGrantedAmount,
        totalVestedAmount,
        totalClaimedAmount,
        totalUnvestedAmount,
        upcomingReleases30Days,
        upcomingAmount30Days,
      },
      upcomingReleases,
      byEmployee,
      projections,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalActiveGrants,
        processedRecords: totalActiveGrants,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'vesting-schedule-projection',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
