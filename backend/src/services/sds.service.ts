import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { PaginationParams } from '../utils/pagination';

export interface SDSTransaction {
  id: string;
  sourceAccount: string;
  destAccount?: string;
  amount?: string;
  assetCode: string;
  assetIssuer?: string;
  operationType: string;
  memo?: string;
  memoType?: string;
  timestamp: number;
  ledgerHeight: number;
  txHash: string;
  successful: boolean;
  fee: string;
  signatures: string[];
}

export interface SDSTransactionFilter {
  sourceAccount?: string;
  destAccount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memoPattern?: string;
  memoType?: string;
  startTime?: number;
  endTime?: number;
  operationType?: string;
  minLedger?: number;
  maxLedger?: number;
}

export interface SDSRateLimitInfo {
  remaining: number;
  limit: number;
  resetTime: number;
}

export class SDSClient {
  private client: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;
  private rateLimitInfo: SDSRateLimitInfo | null = null;

  constructor() {
    if (!config.sds.enabled) {
      logger.warn('SDS is not enabled. Check SDS_ENABLE environment variable.');
    }

    this.client = axios.create({
      baseURL: config.sds.endpoint,
      timeout: config.sds.timeout,
      headers: {
        'Authorization': `Bearer ${config.sds.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.retryAttempts = config.sds.retryAttempts;
    this.retryDelay = config.sds.retryDelay;

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Response interceptor to track rate limits
    this.client.interceptors.response.use(
      (response) => {
        const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
        const rateLimit = response.headers['x-ratelimit-limit'];
        const resetTime = response.headers['x-ratelimit-reset'];

        if (rateLimitRemaining && rateLimit && resetTime) {
          this.rateLimitInfo = {
            remaining: parseInt(rateLimitRemaining, 10),
            limit: parseInt(rateLimit, 10),
            resetTime: parseInt(resetTime, 10),
          };
        }

        return response;
      },
      (error) => {
        logger.error('SDS API Error', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async queryTransactions(
    filter: SDSTransactionFilter,
    pagination: PaginationParams
  ): Promise<{ transactions: SDSTransaction[]; total: number }> {
    try {
      const response = await this.withRetry(() =>
        this.client.get('/transactions', {
          params: {
            ...filter,
            page: pagination.page,
            limit: pagination.limit,
          },
        })
      );

      return {
        transactions: response.data.transactions || [],
        total: response.data.total || 0,
      };
    } catch (error) {
      logger.error('Failed to query transactions', error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<SDSTransaction | null> {
    try {
      const response = await this.withRetry(() =>
        this.client.get(`/transactions/${txHash}`)
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error(`Failed to get transaction ${txHash}`, error);
      throw error;
    }
  }

  async queryAccountTransactions(
    account: string,
    pagination: PaginationParams,
    filter?: Partial<SDSTransactionFilter>
  ): Promise<{ transactions: SDSTransaction[]; total: number }> {
    try {
      const response = await this.withRetry(() =>
        this.client.get(`/accounts/${account}/transactions`, {
          params: {
            ...filter,
            page: pagination.page,
            limit: pagination.limit,
          },
        })
      );

      return {
        transactions: response.data.transactions || [],
        total: response.data.total || 0,
      };
    } catch (error) {
      logger.error(`Failed to query transactions for account ${account}`, error);
      throw error;
    }
  }

  async queryByMemo(
    memoPattern: string,
    pagination: PaginationParams,
    additionalFilter?: Partial<SDSTransactionFilter>
  ): Promise<{ transactions: SDSTransaction[]; total: number }> {
    try {
      const response = await this.withRetry(() =>
        this.client.get('/transactions/search', {
          params: {
            memoPattern,
            ...additionalFilter,
            page: pagination.page,
            limit: pagination.limit,
          },
        })
      );

      return {
        transactions: response.data.transactions || [],
        total: response.data.total || 0,
      };
    } catch (error) {
      logger.error(`Failed to query transactions by memo pattern ${memoPattern}`, error);
      throw error;
    }
  }

  async queryAssetTransactions(
    assetCode: string,
    assetIssuer: string,
    pagination: PaginationParams,
    additionalFilter?: Partial<SDSTransactionFilter>
  ): Promise<{ transactions: SDSTransaction[]; total: number }> {
    try {
      const response = await this.withRetry(() =>
        this.client.get('/assets/transactions', {
          params: {
            assetCode,
            assetIssuer,
            ...additionalFilter,
            page: pagination.page,
            limit: pagination.limit,
          },
        })
      );

      return {
        transactions: response.data.transactions || [],
        total: response.data.total || 0,
      };
    } catch (error) {
      logger.error(`Failed to query transactions for asset ${assetCode}:${assetIssuer}`, error);
      throw error;
    }
  }

  async queryLedgerRange(
    minLedger: number,
    maxLedger: number,
    pagination: PaginationParams
  ): Promise<{ transactions: SDSTransaction[]; total: number }> {
    try {
      const response = await this.withRetry(() =>
        this.client.get('/ledgers/transactions', {
          params: {
            minLedger,
            maxLedger,
            page: pagination.page,
            limit: pagination.limit,
          },
        })
      );

      return {
        transactions: response.data.transactions || [],
        total: response.data.total || 0,
      };
    } catch (error) {
      logger.error(`Failed to query transactions for ledger range ${minLedger}-${maxLedger}`, error);
      throw error;
    }
  }

  async aggregateTransactions(
    filter: SDSTransactionFilter
  ): Promise<{
    totalCount: number;
    successfulCount: number;
    failedCount: number;
    totalAmount: string;
    avgFee: string;
  }> {
    try {
      const response = await this.withRetry(() =>
        this.client.get('/transactions/aggregate', {
          params: filter,
        })
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to aggregate transactions', error);
      throw error;
    }
  }

  getRateLimitInfo(): SDSRateLimitInfo | null {
    return this.rateLimitInfo;
  }

  isRateLimited(): boolean {
    return this.rateLimitInfo ? this.rateLimitInfo.remaining < 10 : false;
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < this.retryAttempts) {
        const backoffDelay = this.retryDelay * Math.pow(2, attempt);
        logger.warn(`Retrying request (attempt ${attempt + 1}/${this.retryAttempts}) after ${backoffDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        return this.withRetry(fn, attempt + 1);
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('SDS health check failed', error);
      return false;
    }
  }
}

export const sdsClient = new SDSClient();
