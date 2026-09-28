import { Queue } from 'bullmq';
import { redisConnection, TX_VERIFICATION_QUEUE_NAME } from '../config/queue.js';
import logger from '../utils/logger.js';

export interface TxVerificationJobData {
  txHash: string;
  /**
   * Optional context for log correlation and future routing.
   * Keep permissive so callers don't need to change often.
   */
  source?: 'payroll' | 'freeze' | 'contract_upgrade' | 'unknown';
  organizationId?: number;
}

export class TransactionVerificationQueueService {
  private static queue: Queue<TxVerificationJobData> | null = null;

  static getQueue(): Queue<TxVerificationJobData> {
    if (!this.queue) {
      this.queue = new Queue<TxVerificationJobData>(TX_VERIFICATION_QUEUE_NAME, {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 15,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 86400,
            count: 5000,
          },
          removeOnFail: {
            age: 604800,
          },
        },
      });
    }
    return this.queue;
  }

  static async enqueue(data: TxVerificationJobData): Promise<string> {
    const queue = this.getQueue();
    const jobId = `tx:${data.txHash}`;

    try {
      const job = await queue.add('verify-tx', data, { jobId });
      logger.info('Tx verification job enqueued', {
        jobId: job.id,
        txHash: data.txHash,
        source: data.source ?? 'unknown',
        organizationId: data.organizationId,
      });
      return job.id!;
    } catch (error: any) {
      // If job already exists, BullMQ throws; treat as success (idempotent).
      const message = typeof error?.message === 'string' ? error.message : '';
      if (message.includes('Job') && message.includes('already exists')) {
        logger.info('Tx verification job already enqueued', {
          jobId,
          txHash: data.txHash,
          source: data.source ?? 'unknown',
        });
        return jobId;
      }
      logger.error('Failed to enqueue tx verification job', {
        txHash: data.txHash,
        source: data.source ?? 'unknown',
        error: message || 'Unknown error',
      });
      throw error;
    }
  }
}

