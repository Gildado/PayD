import { Transaction } from '@stellar/stellar-sdk';
import { ThrottlingService } from './throttlingService.js';
import { StellarService, TransactionResult } from './stellarService.js';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

export interface StellarThrottlingMetrics {
  totalSubmitted: number;
  totalSuccessful: number;
  totalFailed: number;
  totalThrottled: number;
  averageWaitTime: number;
  currentQueueDepth: number;
  lastSubmissionTime: Date | null;
}

export interface ThrottledTransactionOptions {
  priority?: boolean;
  retryOnFailure?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  metadata?: Record<string, any>;
}

/**
 * Stellar-specific throttling service that wraps the generic ThrottlingService
 * to manage Stellar network transaction submission rates and prevent hitting
 * network rate limits.
 */
export class StellarThrottlingService extends EventEmitter {
  private static instance: StellarThrottlingService;
  private throttlingService: ThrottlingService;
  private metrics: StellarThrottlingMetrics;
  private waitTimes: number[] = [];
  private readonly MAX_WAIT_TIME_SAMPLES = 100;

  private constructor() {
    super();
    this.throttlingService = ThrottlingService.getInstance();
    this.metrics = {
      totalSubmitted: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalThrottled: 0,
      averageWaitTime: 0,
      currentQueueDepth: 0,
      lastSubmissionTime: null,
    };

    // Listen to throttling events
    this.throttlingService.on('transaction:queued', (data) => {
      this.metrics.totalThrottled++;
      this.emit('stellar:transaction:queued', data);
    });

    this.throttlingService.on('transaction:processed', (data) => {
      this.emit('stellar:transaction:processed', data);
    });

    this.throttlingService.on('transaction:failed', (data) => {
      this.metrics.totalFailed++;
      this.emit('stellar:transaction:failed', data);
    });

    this.throttlingService.on('transaction:rejected', (data) => {
      this.metrics.totalFailed++;
      this.emit('stellar:transaction:rejected', data);
    });
  }

  static getInstance(): StellarThrottlingService {
    if (!StellarThrottlingService.instance) {
      StellarThrottlingService.instance = new StellarThrottlingService();
    }
    return StellarThrottlingService.instance;
  }

  static resetInstance(): void {
    if (StellarThrottlingService.instance) {
      StellarThrottlingService.instance.removeAllListeners();
      StellarThrottlingService.instance = undefined as any;
    }
  }

  /**
   * Submit a Stellar transaction through the throttling mechanism
   */
  async submitTransaction(
    transaction: Transaction,
    options: ThrottledTransactionOptions = {}
  ): Promise<TransactionResult> {
    const {
      priority = false,
      retryOnFailure = false,
      maxRetries = 3,
      retryDelayMs = 1000,
      metadata = {},
    } = options;

    const transactionId = `stellar-tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info('Submitting Stellar transaction through throttling', {
      transactionId,
      priority,
      metadata,
    });

    this.metrics.totalSubmitted++;

    try {
      const result = await this.throttlingService.submit<TransactionResult>(
        transactionId,
        async () => {
          return this.executeWithRetry(transaction, retryOnFailure, maxRetries, retryDelayMs);
        },
        priority
      );

      const waitTime = Date.now() - startTime;
      this.recordWaitTime(waitTime);

      this.metrics.totalSuccessful++;
      this.metrics.lastSubmissionTime = new Date();
      this.updateMetrics();

      logger.info('Stellar transaction submitted successfully', {
        transactionId,
        hash: result.hash,
        waitTime,
      });

      this.emit('stellar:transaction:success', {
        transactionId,
        hash: result.hash,
        waitTime,
        metadata,
      });

      return result;
    } catch (error) {
      this.metrics.totalFailed++;
      this.updateMetrics();

      logger.error('Stellar transaction submission failed', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
        metadata,
      });

      this.emit('stellar:transaction:error', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
        metadata,
      });

      throw error;
    }
  }

  /**
   * Execute transaction with retry logic
   */
  private async executeWithRetry(
    transaction: Transaction,
    retryOnFailure: boolean,
    maxRetries: number,
    retryDelayMs: number
  ): Promise<TransactionResult> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await StellarService.submitTransaction(transaction);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (!retryOnFailure || attempt > maxRetries) {
          throw lastError;
        }

        logger.warn('Stellar transaction failed, retrying', {
          attempt,
          maxRetries,
          error: lastError.message,
        });

        // Exponential backoff
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  /**
   * Record wait time for metrics
   */
  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > this.MAX_WAIT_TIME_SAMPLES) {
      this.waitTimes.shift();
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const status = this.throttlingService.getStatus();
    this.metrics.currentQueueDepth = status.queueSize;

    if (this.waitTimes.length > 0) {
      this.metrics.averageWaitTime =
        this.waitTimes.reduce((sum, time) => sum + time, 0) / this.waitTimes.length;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): StellarThrottlingMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get throttling status
   */
  getStatus() {
    return this.throttlingService.getStatus();
  }

  /**
   * Update throttling configuration
   */
  updateConfig(config: { tpm?: number; maxQueueSize?: number; refillIntervalMs?: number }): void {
    this.throttlingService.updateConfig(config);
    logger.info('Stellar throttling configuration updated', config);
    this.emit('config:updated', config);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.throttlingService.getConfig();
  }

  /**
   * Clear the transaction queue
   */
  clearQueue(): number {
    const cleared = this.throttlingService.clearQueue();
    logger.warn('Stellar transaction queue cleared', { clearedCount: cleared });
    this.emit('queue:cleared', { clearedCount: cleared });
    return cleared;
  }

  /**
   * Check if the service has capacity to accept more transactions
   */
  hasCapacity(): boolean {
    return this.throttlingService.hasCapacity();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalSubmitted: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalThrottled: 0,
      averageWaitTime: 0,
      currentQueueDepth: 0,
      lastSubmissionTime: null,
    };
    this.waitTimes = [];
    logger.info('Stellar throttling metrics reset');
  }
}

export default StellarThrottlingService;
