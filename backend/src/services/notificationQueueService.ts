import { Queue, Job } from 'bullmq';
import {
  redisConnection,
  NOTIFICATION_QUEUE_NAME,
  notificationQueueConfig,
} from '../config/queue.js';
import logger from '../utils/logger.js';

export interface NotificationJobData {
  transactionId: number;
  transactionHash: string;
  employeeId: number;
  organizationId: number;
  amount: string;
  assetCode: string;
  timestamp: string;
}

export class NotificationQueueService {
  private queue: Queue<NotificationJobData>;

  constructor() {
    this.queue = new Queue<NotificationJobData>(
      NOTIFICATION_QUEUE_NAME,
      {
        connection: redisConnection,
        defaultJobOptions: notificationQueueConfig,
      }
    );

    logger.info('NotificationQueueService initialized', {
      queueName: NOTIFICATION_QUEUE_NAME,
    });
  }

  async enqueuePaymentNotification(
    data: NotificationJobData
  ): Promise<void> {
    try {
      const job = await this.queue.add('payment-notification', data, {
        attempts: notificationQueueConfig.attempts,
        backoff: notificationQueueConfig.backoff,
      });

      logger.info('Payment notification job enqueued', {
        jobId: job.id,
        transactionId: data.transactionId,
        employeeId: data.employeeId,
        organizationId: data.organizationId,
      });
    } catch (error) {
      logger.error('Failed to enqueue payment notification', {
        transactionId: data.transactionId,
        employeeId: data.employeeId,
        organizationId: data.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    state: string;
    progress: number;
    attemptsMade: number;
    failedReason?: string;
  } | null> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        return null;
      }

      const state = await job.getState();

      return {
        id: job.id || jobId,
        state,
        progress: job.progress as number,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
      };
    } catch (error) {
      logger.error('Failed to get job status', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info('NotificationQueueService closed');
  }
}
