import type { PayrollCostForecastReport } from '../../advancedReportService.js';

export const FIXTURE_FORECAST_ORG_ID = 1;

export const FIXTURE_FORECAST_REPORT: PayrollCostForecastReport = {
  reportId: 'rpt-payroll-cost-forecast',
  reportName: 'Payroll Cost Forecast Report',
  generatedAt: '2026-02-01T00:00:00.000Z',
  organizationId: 1,
  summary: {
    currentTotalPayroll: 125000,
    forecastedNextMonthPayroll: 138500,
    expectedHeadcount: 45,
    growthRatePercentage: 10.8,
    confidenceScore: 0.92,
  },
  headcountTrends: [
    { month: 'Nov 2025', headcount: 38, totalCost: 110000 },
    { month: 'Dec 2025', headcount: 40, totalCost: 118000 },
    { month: 'Jan 2026', headcount: 42, totalCost: 125000 },
  ],
  departmentForecasts: [
    { department: 'Engineering', currentCost: 70000, forecastCost: 77000, headcount: 22 },
    { department: 'Sales', currentCost: 35000, forecastCost: 40000, headcount: 13 },
    { department: 'Operations', currentCost: 20000, forecastCost: 21500, headcount: 10 },
  ],
  recommendations: [
    'Engineering headcount expansion is driving 52% of the projected cost increase.',
    'Consider locking in USDC stablecoin conversion rates ahead of the next cycle to hedge against volatility.',
    'Headcount growth rate (approx. 7% MoM) is aligned with quarterly revenue expansion targets.',
  ],
};
