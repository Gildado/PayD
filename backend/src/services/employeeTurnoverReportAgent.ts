/**
 * Employee Turnover Payroll Impact Report Agent (#1298)
 *
 * Quantifies the payroll cost impact of employee turnover over a period.
 * Sources data from the employees table (soft-deleted = turned over) and
 * the payroll history for salary/earnings data.
 *
 * Output schema:
 *   - summary: totalActive, totalTurnedOver, turnoverRate, estimatedPayrollImpact
 *   - byDepartment: per-department turnover stats
 *   - turnedOverEmployees: list of turned-over employees with salary and dates
 */

import type { Pool } from 'pg';
import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface TurnoverFilters {
  organizationId: number;
  startDate?: string;
  endDate?: string;
}

export interface DepartmentTurnover {
  department: string | null;
  totalEmployees: number;
  turnedOver: number;
  turnoverRate: number;
  avgSalary: string;
  estimatedPayrollImpact: string;
}

export interface TurnedOverEmployee {
  id: number;
  firstName: string;
  lastName: string;
  department: string | null;
  position: string | null;
  baseSalary: string;
  baseCurrency: string;
  hireDate: Date | null;
  deletedAt: Date;
  tenureDays: number | null;
}

export interface EmployeeTurnoverReport {
  summary: {
    totalActive: number;
    totalTurnedOver: number;
    turnoverRate: number;
    avgBaseSalary: string;
    estimatedPayrollImpact: string;
  };
  byDepartment: DepartmentTurnover[];
  turnedOverEmployees: TurnedOverEmployee[];
}

export class EmployeeTurnoverReportAgent implements IReportAgent {
  id = 'employee-turnover';
  name = 'Employee Turnover Payroll Impact Report';
  description = 'Quantifies the payroll cost impact of employee turnover over a period';

  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as TurnoverFilters | undefined;
    const organizationId = f?.organizationId ?? 0;
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const startDate = f?.startDate;
    const endDate = f?.endDate;

    const activeConditions = ['organization_id = $1', 'deleted_at IS NULL'];
    const turnoverConditions = ['organization_id = $1', 'deleted_at IS NOT NULL'];
    const activeParams: any[] = [organizationId];
    const turnoverParams: any[] = [organizationId];
    let paramIndex = 2;

    if (startDate) {
      turnoverConditions.push(`deleted_at >= $${paramIndex}`);
      turnoverParams.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      turnoverConditions.push(`deleted_at <= $${paramIndex}`);
      turnoverParams.push(endDate);
      paramIndex++;
    }

    // Active employee count + avg salary
    const activeResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COALESCE(AVG(base_salary), 0)::numeric(18,2) AS avg_salary
      FROM employees
      WHERE ${activeConditions.join(' AND ')}`,
      activeParams
    );
    const totalActive = activeResult.rows[0]?.total ?? 0;
    const avgSalary = activeResult.rows[0]?.avg_salary ?? '0';

    // Turned-over count + avg salary
    const turnoverResult = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COALESCE(AVG(base_salary), 0)::numeric(18,2) AS avg_salary
      FROM employees
      WHERE ${turnoverConditions.join(' AND ')}`,
      turnoverParams
    );
    const totalTurnedOver = turnoverResult.rows[0]?.total ?? 0;
    const turnoverAvgSalary = turnoverResult.rows[0]?.avg_salary ?? '0';

    const turnoverRate = totalActive + totalTurnedOver > 0
      ? Math.round((totalTurnedOver / (totalActive + totalTurnedOver)) * 10000) / 100
      : 0;

    // Estimated payroll impact = turned-over count * avg salary of turned-over employees
    const estimatedPayrollImpact = String(
      Math.round(totalTurnedOver * parseFloat(turnoverAvgSalary) * 100) / 100
    );

    // By-department breakdown
    const deptResult = await this.pool.query(
      `SELECT
        department,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS turned_over,
        COALESCE(AVG(base_salary), 0)::numeric(18,2) AS avg_salary
      FROM employees
      WHERE organization_id = $1
      GROUP BY department
      ORDER BY turned_over DESC`,
      [organizationId]
    );

    const byDepartment: DepartmentTurnover[] = deptResult.rows.map((row) => {
      const deptTotal = row.active + row.turned_over;
      const deptTurnoverRate = deptTotal > 0
        ? Math.round((row.turned_over / deptTotal) * 10000) / 100
        : 0;
      return {
        department: row.department,
        totalEmployees: deptTotal,
        turnedOver: row.turned_over,
        turnoverRate: deptTurnoverRate,
        avgSalary: String(row.avg_salary),
        estimatedPayrollImpact: String(
          Math.round(row.turned_over * parseFloat(row.avg_salary) * 100) / 100
        ),
      };
    });

    // Turned-over employee details
    const empResult = await this.pool.query(
      `SELECT
        id, first_name, last_name, department, position,
        base_salary, base_currency, hire_date, deleted_at,
        EXTRACT(DAY FROM deleted_at - hire_date)::int AS tenure_days
      FROM employees
      WHERE ${turnoverConditions.join(' AND ')}
      ORDER BY deleted_at DESC`,
      turnoverParams
    );

    const turnedOverEmployees: TurnedOverEmployee[] = empResult.rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      position: row.position,
      baseSalary: String(row.base_salary),
      baseCurrency: row.base_currency,
      hireDate: row.hire_date,
      deletedAt: row.deleted_at,
      tenureDays: row.tenure_days,
    }));

    const report: EmployeeTurnoverReport = {
      summary: {
        totalActive,
        totalTurnedOver,
        turnoverRate,
        avgBaseSalary: String(avgSalary),
        estimatedPayrollImpact,
      },
      byDepartment,
      turnedOverEmployees,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: totalActive + totalTurnedOver,
        processedRecords: totalActive + totalTurnedOver,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'employee-turnover',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }
}
