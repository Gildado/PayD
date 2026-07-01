import { payrollWorker } from './payrollWorker.js';
import { notificationWorker } from './notificationWorker.js';
import { schedulerWorker } from './schedulerWorker.js';
import { transactionVerificationWorker } from './transactionVerificationWorker.js';
import { webhookNotificationService } from '../services/webhookNotificationService.js';
import logger from '../utils/logger.js';

let webhookRetryInterval: ReturnType<typeof setInterval> | null = null;

export const startWorkers = () => {
  logger.info('Starting BullMQ workers...');

  if (payrollWorker.isRunning()) {
    logger.info('Payroll worker is running');
  }

  logger.info('Notification worker initialized');
  logger.info('Transaction verification worker initialized');

  webhookRetryInterval = setInterval(async () => {
    try {
      await webhookNotificationService.processPendingRetries();
    } catch (error) {
      logger.error('Error processing pending webhook retries', { error });
    }
  }, 60000);
};

export const stopWorkers = async () => {
  logger.info('Stopping BullMQ workers...');

  if (webhookRetryInterval) {
    clearInterval(webhookRetryInterval);
    webhookRetryInterval = null;
  }

  const closeResults = await Promise.allSettled([
    payrollWorker.close(),
    notificationWorker.close(),
    schedulerWorker.close(),
    transactionVerificationWorker.close(),
  ]);

  for (const result of closeResults) {
    if (result.status === 'rejected') {
      logger.error('Error closing worker', { error: result.reason });
    }
  }

  logger.info('All BullMQ workers stopped');
};
