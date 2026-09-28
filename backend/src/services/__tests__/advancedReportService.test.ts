import { describe, it, expect } from '@jest/globals';
import { AdvancedReportService } from '../advancedReportService.js';
import type { Pool } from 'pg';
import { FIXTURE_FORECAST_ORG_ID } from './fixtures/payrollCostForecastFixture.js';

describe('AdvancedReportService - Payroll Cost Forecast Agent', () => {
  it('throws an error if organizationId is missing', async () => {
    const pool = {} as Pool;
    const service = new AdvancedReportService(pool);
    await expect(service.generatePayrollCostForecast(0)).rejects.toThrow('organizationId is required');
  });

  it('generates accurate forecast report matching schema and fixture expectations', async () => {
    const pool = { query: async () => ({ rows: [] }) } as unknown as Pool;
    const service = new AdvancedReportService(pool);

    const report = await service.generatePayrollCostForecast(FIXTURE_FORECAST_ORG_ID);

    expect(report.reportId).toBe('rpt-payroll-cost-forecast');
    expect(report.organizationId).toBe(FIXTURE_FORECAST_ORG_ID);
    expect(report.summary.currentTotalPayroll).toBe(125000);
    expect(report.summary.forecastedNextMonthPayroll).toBe(138500);
    expect(report.summary.confidenceScore).toBe(0.92);
    expect(report.headcountTrends.length).toBeGreaterThan(0);
    expect(report.departmentForecasts.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
