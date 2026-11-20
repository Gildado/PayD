import { ConnectionOptions, DefaultJobOptions } from 'bullmq';
import { config } from './env.js';

export const redisConnection: ConnectionOptions = {
  url: config.REDIS_URL || 'redis://localhost:6379',
};

export const PAYROLL_QUEUE_NAME = 'payroll-processing';
export const NOTIFICATION_QUEUE_NAME = 'payment-notifications';
export const SCHEDULER_QUEUE_NAME = 'payroll-scheduler';
export const TX_VERIFICATION_QUEUE_NAME = 'tx-verification';

export const DLQ_PREFIX = 'dlq';

export const getDLQName = (queueName: string): string => `${DLQ_PREFIX}:${queueName}`;

export const notificationQueueConfig: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 86400,
    count: 1000,
  },
  removeOnFail: {
    age: 604800,
  },
};

export const payrollQueueConfig: DefaultJobOptions = {
  attempts: 2,
  backoff: {
    type: 'exponential' as const,
    delay: 10000,
  },
  removeOnComplete: {
    age: 86400,
    count: 500,
  },
  removeOnFail: {
    age: 604800,
  },
};

export const schedulerQueueConfig: DefaultJobOptions = {
  attempts: 1,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 86400,
    count: 100,
  },
  removeOnFail: {
    age: 604800,
  },
};

export const txVerificationQueueConfig: DefaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    age: 86400,
    count: 1000,
  },
  removeOnFail: {
    age: 604800,
  },
};
