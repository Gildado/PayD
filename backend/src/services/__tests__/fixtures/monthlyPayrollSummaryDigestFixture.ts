/**
 * Fixture dataset for monthly payroll summary digest agent tests.
 */

export const FIXTURE_ORG_ID = 101;
export const FIXTURE_MONTH = '2025-03';

export const FIXTURE_SUMMARY_ROWS = [
  {
    total_runs: 2,
    total_employees: 15,
    successful_count: 28,
    failed_count: 2,
    pending_count: 0,
    total_usd: '45000.50',
  },
];

export const FIXTURE_ASSET_ROWS = [
  {
    asset_code: 'USDC',
    total_amount: '35000.50',
    payment_count: 20,
  },
  {
    asset_code: 'EURC',
    total_amount: '10000.00',
    payment_count: 10,
  },
];

export const FIXTURE_DEPT_ROWS = [
  {
    department: 'Engineering',
    employee_count: 10,
    total_amount_usd: '30000.00',
  },
  {
    department: 'Marketing',
    employee_count: 5,
    total_amount_usd: '15000.50',
  },
];

export const FIXTURE_EXPECTED = {
  totalPayrollRuns: 2,
  totalEmployeesPaid: 15,
  successfulPaymentsCount: 28,
  failedPaymentsCount: 2,
  totalDisbursedUsd: '45000.50',
  overallSuccessRate: 93.33,
  avgPayoutPerEmployee: '3000.03',
  assetBreakdownCount: 2,
  deptBreakdownCount: 2,
};
