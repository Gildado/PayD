import { Worker, Job } from 'bullmq';
import {
  redisConnection,
  NOTIFICATION_QUEUE_NAME,
} from '../config/queue.js';
import { NotificationJobData } from '../services/notificationQueueService.js';
import { NotificationService } from '../services/notificationService.js';
import logger from '../utils/logger.js';

class NotificationWorker {
  private worker: Worker<NotificationJobData>;
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();

    this.worker = new Worker<NotificationJobData>(
      NOTIFICATION_QUEUE_NAME,
      async (job: Job<NotificationJobData>) => {
        return this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 notifications concurrently
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('Notification job completed', {
        jobId: job.id,
        transactionId: job.data.transactionId,
        employeeId: job.data.employeeId,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Notification job failed', {
        jobId: job?.id,
        transactionId: job?.data.transactionId,
        employeeId: job?.data.employeeId,
        attemptsMade: job?.attemptsMade,
        error: error.message,
      });
    });

    logger.info('NotificationWorker initialized', {
      queueName: NOTIFICATION_QUEUE_NAME,
      concurrency: 5,
    });
  }

  async processJob(job: Job<NotificationJobData>): Promise<void> {
    const { transactionId, transactionHash, employeeId, organizationId, amount, assetCode, timestamp } = job.data;

    logger.info('Processing notification job', {
      jobId: job.id,
      transactionId,
      employeeId,
      organizationId,
      attemptsMade: job.attemptsMade,
    });

    try {
      // Send notification
      const result = await this.notificationService.sendPaymentNotification({
        organizationId,
        employeeId,
        transactionId,
        transactionHash,
        amount,
        assetCode,
        timestamp,
      });

      // Check if both email and push failed
      if (!result.email.success && !result.push.success) {
        throw new Error(
          `Both email and push notifications failed. Email: ${result.email.error}, Push: ${result.push.error}`
        );
      }

      // Log partial success
      if (!result.email.success) {
        logger.warn('Email notification failed but push succeeded', {
          jobId: job.id,
          transactionId,
          employeeId,
          emailError: result.email.error,
        });
      }

      if (!result.push.success) {
        logger.warn('Push notification failed but email succeeded', {
          jobId: job.id,
          transactionId,
          employeeId,
          pushError: result.push.error,
        });
      }

      logger.info('Notification job processed successfully', {
        jobId: job.id,
        transactionId,
        employeeId,
        emailSuccess: result.email.success,
        pushSuccess: result.push.success,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Notification job processing error', {
        jobId: job.id,
        transactionId,
        employeeId,
        organizationId,
        attemptsMade: job.attemptsMade,
        error: errorMessage,
      });

      // Re-throw to trigger retry
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
    logger.info('NotificationWorker closed');
  }
}

// Create and export worker instance
export const notificationWorker = new NotificationWorker();
