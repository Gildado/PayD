/**
 * Monthly Payroll Summary Digest Agent
 *
 * Generates a recurring monthly summary of payroll activity for organization admins,
 * sourcing data from advancedReportService.ts.
 */

import type { Pool } from 'pg';
import { AdvancedReportService } from './advancedReportService.js';

export interface MonthlyPayrollSummaryInput {
  organizationId: number | string;
  month?: string; // Format 'YYYY-MM'
  startDate?: string;
  endDate?: string;
}

export interface MonthlyPayrollSummaryReport {
  schemaVersion: string;
  organizationId: number | string;
  period: string;
  summary: {
    totalEmployeesPaid: number;
    totalPayrollRuns: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalAmountTransacted: string;
    overallSuccessRate: number;
  };
  byAsset: Array<{
    assetCode: string;
    totalAmount: string;
    transactionCount: number;
  }>;
  byDepartment: Array<{
    department: string;
    totalAmount: string;
    employeeCount: number;
  }>;
  anomaliesDetected: Array<{
    txHash?: string;
    employeeId?: string;
    amount: string;
    reason: string;
  }>;
  generatedAt: string;
}

export class MonthlyPayrollSummaryDigestAgent {
  private advancedReportService: AdvancedReportService;

  constructor(pool: Pool) {
    this.advancedReportService = new AdvancedReportService(pool);
  }

  async execute(input: MonthlyPayrollSummaryInput) {
    if (!input.organizationId) {
      throw new Error('organizationId is required');
    }

    const period = input.month || new Date().toISOString().slice(0, 7);
    const startDate = input.startDate || `${period}-01`;
    // Compute last day of month or default endDate
    const [year, monthNum] = period.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).toISOString().slice(0, 10);
    const endDate = input.endDate || lastDay;

    // Source data via AdvancedReportService and underlying database queries if needed
    const reportData = await this.advancedReportService.generatePayrollSummary({
      organizationId: Number(input.organizationId),
      startDate,
      endDate,
    });

    const report: MonthlyPayrollSummaryReport = {
      schemaVersion: '1.0',
      organizationId: input.organizationId,
      period,
      summary: {
        totalEmployeesPaid: reportData.summary.totalEmployeesPaid ?? 0,
        totalPayrollRuns: reportData.summary.totalPayrollRuns ?? 1,
        successfulTransactions: reportData.summary.successfulTransactions ?? 0,
        failedTransactions: reportData.summary.failedTransactions ?? 0,
        totalAmountTransacted: reportData.summary.totalAmountTransacted ?? '0.00',
        overallSuccessRate: reportData.summary.overallSuccessRate ?? 100,
      },
      byAsset: reportData.byAsset ?? [],
      byDepartment: reportData.byDepartment ?? [],
      anomaliesDetected: reportData.anomaliesDetected ?? [],
      generatedAt: new Date().toISOString(),
    };

    return {
      executionId: `exec-${Date.now()}`,
      format: 'JSON',
      data: [report],
      metadata: {
        agentId: 'monthly_payroll_summary_digest',
        period,
        generatedAt: report.generatedAt,
      },
    };
  }

  async validate() {
    return {
      isValid: true,
      issues: [],
      piiDetected: [],
    };
  }
}
