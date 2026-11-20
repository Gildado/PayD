/**
 * Natural-Language Query Service for Payroll Data
 * 
 * Parses plain language queries (e.g., "show failed payroll transactions", "total payout in USDC last month",
 * "search worker W-1001") and filters or summarizes payroll transaction records from CustomReportBuilder.
 */

import type { PayrollTransactionRecord } from './customReportExport';

export interface NaturalLanguageQueryRequest {
  query: string;
  records: PayrollTransactionRecord[];
}

export interface NaturalLanguageQueryResponse {
  query: string;
  matchedCount: number;
  summaryText: string;
  data: PayrollTransactionRecord[];
  aggregates?: {
    totalAmount?: number;
    successCount?: number;
    failedCount?: number;
    assetBreakdown?: Record<string, number>;
  };
  schemaVersion: string;
}

export function executeNaturalLanguagePayrollQuery({
  query,
  records,
}: NaturalLanguageQueryRequest): NaturalLanguageQueryResponse {
  const lowerQuery = query.toLowerCase().trim();
  let filtered = [...records];
  let summaryText = `Found ${filtered.length} matching payroll record(s).`;

  if (lowerQuery.includes('fail') || lowerQuery.includes('error')) {
    filtered = filtered.filter((r) => !r.successful);
    summaryText = `Filtered to ${filtered.length} failed payroll transaction(s).`;
  } else if (lowerQuery.includes('success') || lowerQuery.includes('paid')) {
    filtered = filtered.filter((r) => r.successful);
    summaryText = `Filtered to ${filtered.length} successful payroll transaction(s).`;
  } else if (lowerQuery.includes('usdc')) {
    filtered = filtered.filter((r) => (r.assetCode || 'USDC').toUpperCase() === 'USDC');
    summaryText = `Filtered to ${filtered.length} USDC payroll transaction(s).`;
  } else if (lowerQuery.includes('xlm')) {
    filtered = filtered.filter((r) => (r.assetCode || '').toUpperCase() === 'XLM');
    summaryText = `Filtered to ${filtered.length} XLM payroll transaction(s).`;
  } else {
    // Match employee ID or worker ID if specified
    const matchWorker = lowerQuery.match(/(?:w-|emp-)\d+/i);
    if (matchWorker) {
      const target = matchWorker[0].toUpperCase();
      filtered = filtered.filter(
        (r) =>
          (r.employeeId && r.employeeId.toUpperCase().includes(target)) ||
          r.txHash.toUpperCase().includes(target)
      );
      summaryText = `Found ${filtered.length} record(s) matching worker/ID ${target}.`;
    }
  }

  let totalAmount = 0;
  let successCount = 0;
  let failedCount = 0;
  const assetBreakdown: Record<string, number> = {};

  for (const r of filtered) {
    if (r.successful) successCount++;
    else failedCount++;

    const amt = r.amount ? parseFloat(r.amount) : 0;
    if (!isNaN(amt)) {
      totalAmount += amt;
      const asset = r.assetCode || 'USDC';
      assetBreakdown[asset] = (assetBreakdown[asset] || 0) + amt;
    }
  }

  return {
    query,
    matchedCount: filtered.length,
    summaryText,
    data: filtered,
    aggregates: {
      totalAmount,
      successCount,
      failedCount,
      assetBreakdown,
    },
    schemaVersion: '1.0',
  };
}
