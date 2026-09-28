/**
 * Fixture dataset for Monthly Payroll Summary Digest Agent tests.
 */

export const FIXTURE_ORG_ID = 101;

export const FIXTURE_MONTH = '2024-03';

export const FIXTURE_REPORT_DATA = {
  summary: {
    totalEmployeesPaid: 25,
    totalPayrollRuns: 4,
    successfulTransactions: 24,
    failedTransactions: 1,
    totalAmountTransacted: '45250.00',
    overallSuccessRate: 96.0,
  },
  byAsset: [
    { assetCode: 'USDC', totalAmount: '35250.00', transactionCount: 20 },
    { assetCode: 'EURC', totalAmount: '10000.00', transactionCount: 5 },
  ],
  byDepartment: [
    { department: 'Engineering', totalAmount: '30000.00', employeeCount: 15 },
    { department: 'Marketing', totalAmount: '15250.00', employeeCount: 10 },
  ],
  anomaliesDetected: [
    {
      txHash: 'tx-anomaly-001',
      employeeId: 'EMP-015',
      amount: '5000.00',
      reason: 'Unusually high bonus payment exceeding 50% of base',
    },
  ],
};

export const FIXTURE_EXPECTED = {
  schemaVersion: '1.0',
  organizationId: FIXTURE_ORG_ID,
  period: FIXTURE_MONTH,
  totalEmployeesPaid: 25,
  totalAmountTransacted: '45250.00',
  overallSuccessRate: 96.0,
  assetCount: 2,
  departmentCount: 2,
  anomalyCount: 1,
} as const;
