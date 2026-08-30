/**
 * Monthly Payroll Summary Digest Agent
 *
 * Generates a monthly digest report summarizing payroll activity for an organization.
 * Includes total runs, disbursement amounts, asset breakdowns, status metrics, and department breakdowns.
 *
 * Output Schema:
 * - executionId: unique execution ID
 * - reportId: 'rpt-monthly-payroll-digest'
 * - reportName: 'Monthly Payroll Summary Digest'
 * - generatedAt: ISO timestamp
 * - format: 'JSON' | 'CSV' | 'PDF'
 * - data: [MonthlyPayrollDigestReportData]
 * - summary: aggregated execution metrics
 */

import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

export interface MonthlyPayrollDigestOptions {
  organizationId: number;
  month?: string; // YYYY-MM format (e.g., '2025-03')
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface MonthlyPayrollDigestAssetSummary {
  assetCode: string;
  totalAmount: string;
  paymentCount: number;
  percentageOfTotal: number;
}

export interface MonthlyPayrollDigestDepartmentSummary {
  department: string;
  employeeCount: number;
  totalAmountUsd: string;
}

export interface MonthlyPayrollDigestReportData {
  schemaVersion: string;
  organizationId: number;
  period: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalPayrollRuns: number;
    totalEmployeesPaid: number;
    totalDisbursedUsd: string;
    successfulPaymentsCount: number;
    failedPaymentsCount: number;
    overallSuccessRate: number;
    avgPayoutPerEmployee: string;
  };
  assetBreakdown: MonthlyPayrollDigestAssetSummary[];
  statusBreakdown: {
    completed: number;
    failed: number;
    pending: number;
  };
  departmentBreakdown: MonthlyPayrollDigestDepartmentSummary[];
  highlights: string[];
}

export interface ReportAgentResult<T = MonthlyPayrollDigestReportData> {
  executionId: string;
  reportId: string;
  reportName: string;
  generatedAt: string;
  format: 'JSON' | 'CSV' | 'PDF';
  data: T[];
  summary: {
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    totalDisbursedUsd?: string;
  };
}

export class MonthlyPayrollSummaryDigestAgent {
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  async execute(
    options: MonthlyPayrollDigestOptions
  ): Promise<ReportAgentResult<MonthlyPayrollDigestReportData>> {
    if (!options || !options.organizationId) {
      throw new Error('organizationId is required');
    }

    const orgId = options.organizationId;
    let startDate: Date;
    let endDate: Date;

    if (options.month) {
      const parts = options.month.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    } else if (options.startDate && options.endDate) {
      startDate = new Date(options.startDate);
      endDate = new Date(options.endDate);
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    let totalPayrollRuns = 0;
    let totalEmployeesPaid = 0;
    let successfulPaymentsCount = 0;
    let failedPaymentsCount = 0;
    let pendingPaymentsCount = 0;
    let totalDisbursedUsd = '0.00';
    let assetBreakdown: MonthlyPayrollDigestAssetSummary[] = [];
    let departmentBreakdown: MonthlyPayrollDigestDepartmentSummary[] = [];

    if (this.pool) {
      const summaryResult = await this.pool.query(
        `SELECT
          COUNT(DISTINCT pr.id)::int as total_runs,
          COUNT(DISTINCT p.employee_id)::int as total_employees,
          COUNT(CASE WHEN p.status = 'completed' THEN 1 END)::int as successful_count,
          COUNT(CASE WHEN p.status = 'failed' THEN 1 END)::int as failed_count,
          COUNT(CASE WHEN p.status = 'pending' THEN 1 END)::int as pending_count,
          COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount_usd ELSE 0 END), 0)::numeric as total_usd
         FROM payroll_runs pr
         LEFT JOIN payroll_payments p ON p.payroll_run_id = pr.id
         WHERE pr.organization_id = $1 AND pr.created_at >= $2 AND pr.created_at <= $3`,
        [orgId, startDate.toISOString(), endDate.toISOString()]
      );

      if (summaryResult.rows.length > 0) {
        const row = summaryResult.rows[0];
        totalPayrollRuns = Number(row.total_runs || 0);
        totalEmployeesPaid = Number(row.total_employees || 0);
        successfulPaymentsCount = Number(row.successful_count || 0);
        failedPaymentsCount = Number(row.failed_count || 0);
        pendingPaymentsCount = Number(row.pending_count || 0);
        totalDisbursedUsd = parseFloat(row.total_usd || '0').toFixed(2);
      }

      const assetResult = await this.pool.query(
        `SELECT
          p.asset_code,
          SUM(p.amount)::numeric as total_amount,
          COUNT(p.id)::int as payment_count
         FROM payroll_payments p
         JOIN payroll_runs pr ON p.payroll_run_id = pr.id
         WHERE pr.organization_id = $1 AND pr.created_at >= $2 AND pr.created_at <= $3 AND p.status = 'completed'
         GROUP BY p.asset_code`,
        [orgId, startDate.toISOString(), endDate.toISOString()]
      );

      const totalAssetSum = assetResult.rows.reduce(
        (acc, r) => acc + parseFloat(r.total_amount || '0'),
        0
      );
      assetBreakdown = assetResult.rows.map((r) => {
        const amt = parseFloat(r.total_amount || '0');
        return {
          assetCode: r.asset_code || 'USDC',
          totalAmount: amt.toFixed(2),
          paymentCount: Number(r.payment_count || 0),
          percentageOfTotal:
            totalAssetSum > 0 ? parseFloat(((amt / totalAssetSum) * 100).toFixed(2)) : 0,
        };
      });

      const deptResult = await this.pool.query(
        `SELECT
          COALESCE(e.department, 'Unassigned') as department,
          COUNT(DISTINCT e.id)::int as employee_count,
          SUM(p.amount_usd)::numeric as total_amount_usd
         FROM payroll_payments p
         JOIN payroll_runs pr ON p.payroll_run_id = pr.id
         JOIN employees e ON p.employee_id = e.id
         WHERE pr.organization_id = $1 AND pr.created_at >= $2 AND pr.created_at <= $3 AND p.status = 'completed'
         GROUP BY e.department`,
        [orgId, startDate.toISOString(), endDate.toISOString()]
      );

      departmentBreakdown = deptResult.rows.map((r) => ({
        department: r.department,
        employeeCount: Number(r.employee_count || 0),
        totalAmountUsd: parseFloat(r.total_amount_usd || '0').toFixed(2),
      }));
    }

    const totalProcessed = successfulPaymentsCount + failedPaymentsCount + pendingPaymentsCount;
    const overallSuccessRate =
      totalProcessed > 0
        ? parseFloat(((successfulPaymentsCount / totalProcessed) * 100).toFixed(2))
        : 100.0;

    const avgPayoutPerEmployee =
      totalEmployeesPaid > 0
        ? (parseFloat(totalDisbursedUsd) / totalEmployeesPaid).toFixed(2)
        : '0.00';

    const highlights: string[] = [];
    if (totalPayrollRuns > 0) {
      highlights.push(
        `Processed ${totalPayrollRuns} payroll run(s) with ${totalEmployeesPaid} employee(s) paid.`
      );
    }
    if (failedPaymentsCount > 0) {
      highlights.push(`Attention needed: ${failedPaymentsCount} payment(s) failed during this period.`);
    } else if (totalProcessed > 0) {
      highlights.push('100% payment success rate achieved with no failed disbursements.');
    }

    const reportData: MonthlyPayrollDigestReportData = {
      schemaVersion: '1.0',
      organizationId: orgId,
      period: {
        year: startDate.getUTCFullYear(),
        month: startDate.getUTCMonth() + 1,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalPayrollRuns,
        totalEmployeesPaid,
        totalDisbursedUsd,
        successfulPaymentsCount,
        failedPaymentsCount,
        overallSuccessRate,
        avgPayoutPerEmployee,
      },
      assetBreakdown,
      statusBreakdown: {
        completed: successfulPaymentsCount,
        failed: failedPaymentsCount,
        pending: pendingPaymentsCount,
      },
      departmentBreakdown,
      highlights,
    };

    const execId = typeof randomUUID === 'function' ? randomUUID() : `exec-${Date.now()}`;

    return {
      executionId: `exec-${execId}`,
      reportId: 'rpt-monthly-payroll-digest',
      reportName: 'Monthly Payroll Summary Digest',
      generatedAt: new Date().toISOString(),
      format: 'JSON',
      data: [reportData],
      summary: {
        totalRecords: totalProcessed,
        processedRecords: successfulPaymentsCount,
        failedRecords: failedPaymentsCount,
        totalDisbursedUsd,
      },
    };
  }
}
