import logger from '../utils/logger';
import { PaginationParams, createPaginatedResult, PaginatedResult } from '../utils/pagination';
import { SDSTransaction } from './sds.service';

export interface PayrollMemoFormat {
  type: 'PAYROLL' | 'BONUS' | 'INVOICE' | 'OTHER';
  employeeId?: string;
  payrollBatchId?: string;
  period?: string;
  rawMemo: string;
}

export interface PayrollTransaction extends SDSTransaction {
  payrollMemo?: PayrollMemoFormat;
  isPayrollRelated: boolean;
  employeeId?: string;
  payrollBatchId?: string;
  period?: string;
}

export interface PayrollIndexQuery {
  organizationPublicKey: string;
  employeeId?: string;
  payrollBatchId?: string;
  startDate?: Date;
  endDate?: Date;
  assetCode?: string;
  assetIssuer?: string;
  minAmount?: string;
  maxAmount?: string;
  includeFailedPayments?: boolean;
}

export interface PayrollAggregation {
  totalCount: number;
  successfulCount: number;
  failedCount: number;
  totalDisbursed: string;
  avgPaymentAmount: string;
  dateRange: {
    start: number;
    end: number;
  };
  byAsset: Record<string, {
    count: number;
    totalAmount: string;
  }>;
  byStatus: {
    successful: number;
    failed: number;
  };
}

export class PayrollIndexingService {
  private payrollMemoRegex = /^PAYROLL:([^:]+):([^:]+)(?::(.+))?$/;
  private bonusMemoRegex = /^BONUS:([^:]+)(?::(.+))?$/;
  private invoiceMemoRegex = /^INVOICE:([^:]+)(?::(.+))?$/;

  parsePayrollMemo(memo?: string): PayrollMemoFormat | null {
    if (!memo) return null;

    // Check PAYROLL format: PAYROLL:<employee_id>:<batch_id>:<period>
    const payrollMatch = memo.match(this.payrollMemoRegex);
    if (payrollMatch) {
      return {
        type: 'PAYROLL',
        employeeId: payrollMatch[1],
        payrollBatchId: payrollMatch[2],
        period: payrollMatch[3],
        rawMemo: memo,
      };
    }

    // Check BONUS format: BONUS:<employee_id>:<description>
    const bonusMatch = memo.match(this.bonusMemoRegex);
    if (bonusMatch) {
      return {
        type: 'BONUS',
        employeeId: bonusMatch[1],
        rawMemo: memo,
      };
    }

    // Check INVOICE format: INVOICE:<invoice_id>:<description>
    const invoiceMatch = memo.match(this.invoiceMemoRegex);
    if (invoiceMatch) {
      return {
        type: 'INVOICE',
        payrollBatchId: invoiceMatch[1],
        rawMemo: memo,
      };
    }

    return null;
  }

  enrichTransaction(transaction: SDSTransaction): PayrollTransaction {
    const payrollMemo = this.parsePayrollMemo(transaction.memo);
    const isPayrollRelated = payrollMemo !== null;

    return {
      ...transaction,
      payrollMemo: payrollMemo || undefined,
      isPayrollRelated,
      employeeId: payrollMemo?.employeeId,
      payrollBatchId: payrollMemo?.payrollBatchId,
      period: payrollMemo?.period,
    };
  }

  enrichTransactions(transactions: SDSTransaction[]): PayrollTransaction[] {
    return transactions.map((tx) => this.enrichTransaction(tx));
  }

  filterPayrollTransactions(
    transactions: PayrollTransaction[],
    query: Partial<PayrollIndexQuery>
  ): PayrollTransaction[] {
    return transactions.filter((tx) => {
      // Filter by employee ID
      if (query.employeeId && tx.employeeId !== query.employeeId) {
        return false;
      }

      // Filter by payroll batch ID
      if (query.payrollBatchId && tx.payrollBatchId !== query.payrollBatchId) {
        return false;
      }

      // Filter by asset
      if (query.assetCode && tx.assetCode !== query.assetCode) {
        return false;
      }

      if (query.assetIssuer && tx.assetIssuer !== query.assetIssuer) {
        return false;
      }

      // Filter by date range
      if (query.startDate && tx.timestamp < query.startDate.getTime() / 1000) {
        return false;
      }

      if (query.endDate && tx.timestamp > query.endDate.getTime() / 1000) {
        return false;
      }

      // Filter by amount
      const amount = parseFloat(tx.amount || '0');
      if (query.minAmount && amount < parseFloat(query.minAmount)) {
        return false;
      }

      if (query.maxAmount && amount > parseFloat(query.maxAmount)) {
        return false;
      }

      // Filter by success status
      if (query.includeFailedPayments === false && !tx.successful) {
        return false;
      }

      return true;
    });
  }

  aggregatePayrollTransactions(
    transactions: PayrollTransaction[]
  ): PayrollAggregation {
    const successful = transactions.filter((tx) => tx.successful);
    const failed = transactions.filter((tx) => !tx.successful);

    const totalAmount = successful.reduce((sum, tx) => {
      return sum + parseFloat(tx.amount || '0');
    }, 0);

    const byAsset: Record<string, { count: number; totalAmount: string }> = {};

    successful.forEach((tx) => {
      const key = `${tx.assetCode}:${tx.assetIssuer || 'native'}`;
      if (!byAsset[key]) {
        byAsset[key] = { count: 0, totalAmount: '0' };
      }
      byAsset[key].count += 1;
      byAsset[key].totalAmount = (
        parseFloat(byAsset[key].totalAmount) + parseFloat(tx.amount || '0')
      ).toString();
    });

    const timestamps = transactions.map((tx) => tx.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    return {
      totalCount: transactions.length,
      successfulCount: successful.length,
      failedCount: failed.length,
      totalDisbursed: totalAmount.toString(),
      avgPaymentAmount: (totalAmount / successful.length).toString(),
      dateRange: {
        start: minTimestamp,
        end: maxTimestamp,
      },
      byAsset,
      byStatus: {
        successful: successful.length,
        failed: failed.length,
      },
    };
  }

  generatePayrollBatchReport(
    transactions: PayrollTransaction[]
  ): Record<string, {
    employeeCount: number;
    transactions: PayrollTransaction[];
    aggregation: PayrollAggregation;
  }> {
    const byBatch: Record<string, PayrollTransaction[]> = {};

    transactions.forEach((tx) => {
      const batchId = tx.payrollBatchId || 'unbatched';
      if (!byBatch[batchId]) {
        byBatch[batchId] = [];
      }
      byBatch[batchId].push(tx);
    });

    const report: Record<string, any> = {};

    Object.entries(byBatch).forEach(([batchId, batchTransactions]) => {
      const employees = new Set(batchTransactions.map((tx) => tx.employeeId).filter(Boolean));
      report[batchId] = {
        employeeCount: employees.size,
        transactions: batchTransactions,
        aggregation: this.aggregatePayrollTransactions(batchTransactions),
      };
    });

    return report;
  }

  generateEmployeePayrollSummary(
    transactions: PayrollTransaction[],
    employeeId: string
  ): {
    employeeId: string;
    totalPayments: number;
    totalAmount: string;
    successfulPayments: number;
    failedPayments: number;
    byAsset: Record<string, string>;
    dateRange: {
      first: number;
      last: number;
    };
  } {
    const employeeTransactions = transactions.filter(
      (tx) => tx.employeeId === employeeId || tx.destAccount
    );

    const successful = employeeTransactions.filter((tx) => tx.successful);
    const failed = employeeTransactions.filter((tx) => !tx.successful);

    const totalAmount = successful.reduce((sum, tx) => {
      return sum + parseFloat(tx.amount || '0');
    }, 0);

    const byAsset: Record<string, string> = {};

    successful.forEach((tx) => {
      const key = tx.assetCode;
      if (!byAsset[key]) {
        byAsset[key] = '0';
      }
      byAsset[key] = (parseFloat(byAsset[key]) + parseFloat(tx.amount || '0')).toString();
    });

    const timestamps = employeeTransactions.map((tx) => tx.timestamp);

    return {
      employeeId,
      totalPayments: employeeTransactions.length,
      totalAmount: totalAmount.toString(),
      successfulPayments: successful.length,
      failedPayments: failed.length,
      byAsset,
      dateRange: {
        first: Math.min(...timestamps),
        last: Math.max(...timestamps),
      },
    };
  }

  paginateTransactions<T extends PayrollTransaction>(
    transactions: T[],
    pagination: PaginationParams
  ): PaginatedResult<T> {
    const { offset, limit } = pagination;
    const paginatedData = transactions.slice(offset, offset + limit);

    return createPaginatedResult(paginatedData, transactions.length, pagination.page, limit);
  }

  sortTransactions(
    transactions: PayrollTransaction[],
    sortBy: 'timestamp' | 'amount' | 'employeeId' = 'timestamp',
    order: 'asc' | 'desc' = 'desc'
  ): PayrollTransaction[] {
    const sorted = [...transactions].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'timestamp':
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case 'amount':
          aVal = parseFloat(a.amount || '0');
          bVal = parseFloat(b.amount || '0');
          break;
        case 'employeeId':
          aVal = a.employeeId || '';
          bVal = b.employeeId || '';
          break;
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }

      if (order === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return sorted;
  }
}

export const payrollIndexingService = new PayrollIndexingService();
