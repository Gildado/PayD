import { ConnectionOptions } from 'bullmq';
import { config } from './env.js';

export const redisConnection: ConnectionOptions = {
  url: config.REDIS_URL || 'redis://localhost:6379',
};

export const PAYROLL_QUEUE_NAME = 'payroll-processing';
export const NOTIFICATION_QUEUE_NAME = 'payment-notifications';
export const SCHEDULER_QUEUE_NAME = 'payroll-scheduler';
export const TX_VERIFICATION_QUEUE_NAME = 'tx-verification';

export const notificationQueueConfig = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5 seconds initial delay
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
  },
};
