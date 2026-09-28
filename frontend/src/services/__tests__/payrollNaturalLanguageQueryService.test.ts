import { describe, expect, it } from 'vitest';
import {
  executeNaturalLanguagePayrollQuery,
} from '../payrollNaturalLanguageQueryService';
import type { PayrollTransactionRecord } from '../customReportExport';

const FIXTURE_RECORDS: PayrollTransactionRecord[] = [
  {
    txHash: 'hash1',
    sourceAccount: 'GSRC',
    amount: '500.00',
    assetCode: 'USDC',
    operationType: 'payment',
    timestamp: 1704067200,
    ledgerHeight: 100,
    successful: true,
    fee: '100',
    signatures: [],
    employeeId: 'EMP-001',
    itemType: 'base',
  },
  {
    txHash: 'hash2',
    sourceAccount: 'GSRC',
    amount: '750.50',
    assetCode: 'USDC',
    operationType: 'payment',
    timestamp: 1704153600,
    ledgerHeight: 101,
    successful: false,
    fee: '100',
    signatures: [],
    employeeId: 'EMP-002',
    itemType: 'bonus',
  },
  {
    txHash: 'hash3',
    sourceAccount: 'GSRC',
    amount: '1200.00',
    assetCode: 'XLM',
    operationType: 'payment',
    timestamp: 1704240000,
    ledgerHeight: 102,
    successful: true,
    fee: '100',
    signatures: [],
    employeeId: 'EMP-003',
    itemType: 'base',
  },
];

describe('payrollNaturalLanguageQueryService', () => {
  it('returns all records and computes aggregates for broad queries', () => {
    const res = executeNaturalLanguagePayrollQuery({
      query: 'show all payroll data',
      records: FIXTURE_RECORDS,
    });
    expect(res.matchedCount).toBe(3);
    expect(res.aggregates?.successCount).toBe(2);
    expect(res.aggregates?.failedCount).toBe(1);
    expect(res.aggregates?.totalAmount).toBe(2450.5);
    expect(res.schemaVersion).toBe('1.0');
  });

  it('filters by failed transactions correctly', () => {
    const res = executeNaturalLanguagePayrollQuery({
      query: 'show failed payments',
      records: FIXTURE_RECORDS,
    });
    expect(res.matchedCount).toBe(1);
    expect(res.data[0].txHash).toBe('hash2');
  });

  it('filters by USDC asset correctly', () => {
    const res = executeNaturalLanguagePayrollQuery({
      query: 'total payout in usdc',
      records: FIXTURE_RECORDS,
    });
    expect(res.matchedCount).toBe(2);
    expect(res.aggregates?.assetBreakdown?.USDC).toBe(1250.5);
  });

  it('filters by worker/employee ID correctly', () => {
    const res = executeNaturalLanguagePayrollQuery({
      query: 'search worker EMP-001',
      records: FIXTURE_RECORDS,
    });
    expect(res.matchedCount).toBe(1);
    expect(res.data[0].employeeId).toBe('EMP-001');
  });
});
