/**
 * Shared data shapes for the analytics charts.
 *
 * This module intentionally has no dependency on `recharts` so the page can
 * import these types eagerly without pulling the charting library into the
 * initial bundle.
 */

export interface PayrollTrend {
  month: string;
  total: number;
  count: number;
  [key: string]: unknown;
}

export interface CurrencyShare {
  currency: string;
  value: number;
  [key: string]: unknown;
}

export interface PaymentMetric {
  month: string;
  success: number;
  failure: number;
  pending: number;
  [key: string]: unknown;
}

export interface DepartmentStat {
  department: string;
  total: number;
  headcount: number;
  [key: string]: unknown;
}

export interface AnalyticsSummary {
  totalPayroll: number;
  totalTransactions: number;
  successRate: number;
  activeEmployees: number;
}

export interface AnalyticsData {
  trends: PayrollTrend[];
  currencyBreakdown: CurrencyShare[];
  paymentMetrics: PaymentMetric[];
  departmentBreakdown: DepartmentStat[];
  summary: AnalyticsSummary;
}

/** Value shape recharts hands to tooltip formatters (v3). */
export type RechartsValue = number | string | readonly (number | string)[] | undefined;

export type TrendChartType = 'line' | 'area';
