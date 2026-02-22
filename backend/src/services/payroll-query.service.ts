import { sdsClient, SDSTransaction, SDSTransactionFilter } from './sds.service';
import {
  payrollIndexingService,
  PayrollIndexQuery,
  PayrollTransaction,
  PayrollAggregation,
} from './payroll-indexing.service';
import { parsePaginationParams, PaginationParams, PaginatedResult } from '../utils/pagination';
import logger from '../utils/logger';

export interface PayrollQueryOptions {
  useCache?: boolean;
  cacheTtl?: number;
  enrichPayrollData?: boolean;
  sortBy?: 'timestamp' | 'amount' | 'employeeId';
  sortOrder?: 'asc' | 'desc';
}

export class PayrollQueryService {
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  /**
   * Query payroll transactions with advanced filtering and indexing
   */
  async queryPayroll(
    query: PayrollIndexQuery,
    page?: number,
    limit?: number,
    options: PayrollQueryOptions = {}
  ): Promise<PaginatedResult<PayrollTransaction>> {
    const pagination = parsePaginationParams(page, limit);

    // Generate cache key
    const cacheKey = this.generateCacheKey('queryPayroll', { query, pagination });

    // Check cache
    if (options.useCache && this.getCachedData(cacheKey)) {
      logger.debug('Returning cached payroll query result');
      return this.getCachedData(cacheKey);
    }

    try {
      // Convert PayrollIndexQuery to SDSTransactionFilter
      const sdsFilter: SDSTransactionFilter = {
        sourceAccount: query.organizationPublicKey,
        assetCode: query.assetCode,
        assetIssuer: query.assetIssuer,
        startTime: query.startDate ? Math.floor(query.startDate.getTime() / 1000) : undefined,
        endTime: query.endDate ? Math.floor(query.endDate.getTime() / 1000) : undefined,
      };

      // Query SDS
      const { transactions: rawTransactions, total } = await sdsClient.queryTransactions(
        sdsFilter,
        pagination
      );

      // Enrich with payroll-specific data
      const enrichedTransactions = options.enrichPayrollData
        ? payrollIndexingService.enrichTransactions(rawTransactions)
        : rawTransactions.map((tx): PayrollTransaction => ({ ...tx, isPayrollRelated: false }));

      // Apply additional filtering
      let filtered = payrollIndexingService.filterPayrollTransactions(enrichedTransactions, query);

      // Apply sorting
      if (options.sortBy) {
        filtered = payrollIndexingService.sortTransactions(
          filtered,
          options.sortBy,
          options.sortOrder
        );
      }

      // Paginate
      const result = payrollIndexingService.paginateTransactions(filtered, pagination);

      // Cache result
      if (options.useCache) {
        this.setCachedData(
          cacheKey,
          result,
          options.cacheTtl || 3600000
        );
      }

      logger.info(`Payroll query completed: ${result.data.length} transactions`);
      return result;
    } catch (error) {
      logger.error('Payroll query failed', error);
      throw error;
    }
  }

  /**
   * Get payroll for a specific employee
   */
  async getEmployeePayroll(
    organizationPublicKey: string,
    employeeId: string,
    startDate?: Date,
    endDate?: Date,
    page?: number,
    limit?: number
  ): Promise<PaginatedResult<PayrollTransaction>> {
    const query: PayrollIndexQuery = {
      organizationPublicKey,
      employeeId,
      startDate,
      endDate,
    };

    return this.queryPayroll(query, page, limit, {
      enrichPayrollData: true,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  }

  /**
   * Get payroll batch details
   */
  async getPayrollBatch(
    organizationPublicKey: string,
    batchId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResult<PayrollTransaction>> {
    const query: PayrollIndexQuery = {
      organizationPublicKey,
      payrollBatchId: batchId,
    };

    return this.queryPayroll(query, page, limit, {
      enrichPayrollData: true,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  }

  /**
   * Get aggregated payroll statistics
   */
  async getPayrollAggregation(
    organizationPublicKey: string,
    startDate?: Date,
    endDate?: Date,
    assetCode?: string,
    assetIssuer?: string
  ): Promise<PayrollAggregation> {
    const pagination = parsePaginationParams(1, 1000);

    try {
      const sdsFilter: SDSTransactionFilter = {
        sourceAccount: organizationPublicKey,
        assetCode,
        assetIssuer,
        startTime: startDate ? Math.floor(startDate.getTime() / 1000) : undefined,
        endTime: endDate ? Math.floor(endDate.getTime() / 1000) : undefined,
      };

      const { transactions: rawTransactions } = await sdsClient.queryTransactions(
        sdsFilter,
        pagination
      );

      const enriched = payrollIndexingService.enrichTransactions(rawTransactions);
      const payrollTransactions = enriched.filter((tx) => tx.isPayrollRelated);

      return payrollIndexingService.aggregatePayrollTransactions(payrollTransactions);
    } catch (error) {
      logger.error('Failed to get payroll aggregation', error);
      throw error;
    }
  }

  /**
   * Get organization-wide audit report
   */
  async getOrganizationAuditReport(
    organizationPublicKey: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    aggregation: PayrollAggregation;
    batchReports: Record<string, any>;
    dateRange: { start: Date; end: Date };
  }> {
    const pagination = parsePaginationParams(1, 5000);

    try {
      logger.info(`Generating audit report for org ${organizationPublicKey}`);

      const sdsFilter: SDSTransactionFilter = {
        sourceAccount: organizationPublicKey,
        startTime: startDate ? Math.floor(startDate.getTime() / 1000) : undefined,
        endTime: endDate ? Math.floor(endDate.getTime() / 1000) : undefined,
      };

      const { transactions: rawTransactions } = await sdsClient.queryTransactions(
        sdsFilter,
        pagination
      );

      const enriched = payrollIndexingService.enrichTransactions(rawTransactions);
      const aggregation = payrollIndexingService.aggregatePayrollTransactions(enriched);
      const batchReports = payrollIndexingService.generatePayrollBatchReport(enriched);

      logger.info(
        `Audit report generated: ${aggregation.totalCount} total transactions, ` +
        `${aggregation.successfulCount} successful, ${aggregation.failedCount} failed`
      );

      return {
        aggregation,
        batchReports,
        dateRange: {
          start: startDate || new Date(aggregation.dateRange.start * 1000),
          end: endDate || new Date(aggregation.dateRange.end * 1000),
        },
      };
    } catch (error) {
      logger.error('Failed to generate audit report', error);
      throw error;
    }
  }

  /**
   * Search transactions by memo pattern
   */
  async searchByMemoPattern(
    organizationPublicKey: string,
    memoPattern: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResult<PayrollTransaction>> {
    const pagination = parsePaginationParams(page, limit);

    try {
      const filter: SDSTransactionFilter = {
        sourceAccount: organizationPublicKey,
        memoPattern,
      };

      const { transactions: rawTransactions, total } = await sdsClient.queryTransactions(
        filter,
        pagination
      );

      const enriched = payrollIndexingService.enrichTransactions(rawTransactions);
      return payrollIndexingService.paginateTransactions(enriched, pagination);
    } catch (error) {
      logger.error(`Failed to search by memo pattern ${memoPattern}`, error);
      throw error;
    }
  }

  /**
   * Get transaction details by hash
   */
  async getTransactionDetails(txHash: string): Promise<PayrollTransaction | null> {
    try {
      const tx = await sdsClient.getTransaction(txHash);
      if (!tx) return null;

      return payrollIndexingService.enrichTransaction(tx);
    } catch (error) {
      logger.error(`Failed to get transaction ${txHash}`, error);
      throw error;
    }
  }

  /**
   * Get employee payroll summary
   */
  async getEmployeeSummary(
    organizationPublicKey: string,
    employeeId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      const pagination = parsePaginationParams(1, 10000);

      const query: PayrollIndexQuery = {
        organizationPublicKey,
        employeeId,
        startDate,
        endDate,
      };

      const result = await this.queryPayroll(query, pagination.page, pagination.limit, {
        enrichPayrollData: true,
      });

      return payrollIndexingService.generateEmployeePayrollSummary(result.data, employeeId);
    } catch (error) {
      logger.error(`Failed to get employee summary for ${employeeId}`, error);
      throw error;
    }
  }

  /**
   * Get SDS rate limit information
   */
  getSDSRateLimitInfo() {
    return sdsClient.getRateLimitInfo();
  }

  /**
   * Check SDS health status
   */
  async checkSDSHealth(): Promise<boolean> {
    return sdsClient.healthCheck();
  }

  // Cache management
  private generateCacheKey(operation: string, params: any): string {
    return `${operation}:${JSON.stringify(params)}`;
  }

  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).length,
    };
  }
}

export const payrollQueryService = new PayrollQueryService();
