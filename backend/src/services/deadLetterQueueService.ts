import { Queue, Worker, Job } from 'bullmq';
import {
  redisConnection,
  PAYROLL_QUEUE_NAME,
  NOTIFICATION_QUEUE_NAME,
  SCHEDULER_QUEUE_NAME,
  TX_VERIFICATION_QUEUE_NAME,
  getDLQName,
} from '../config/queue.js';
import logger from '../utils/logger.js';

export interface DLQJob {
  jobId: string;
  queueName: string;
  jobName: string;
  data: any;
  error: string;
  failedAttempts: number;
  timestamp: string;
}

export class DeadLetterQueueService {
  private dlqQueues: Map<string, Queue> = new Map();

  constructor() {
    this.initializeDLQs();
  }

  private initializeDLQs(): void {
    const queueNames = [
      PAYROLL_QUEUE_NAME,
      NOTIFICATION_QUEUE_NAME,
      SCHEDULER_QUEUE_NAME,
      TX_VERIFICATION_QUEUE_NAME,
    ];

    for (const queueName of queueNames) {
      const dlqName = getDLQName(queueName);
      const queue = new Queue(dlqName, { connection: redisConnection });
      this.dlqQueues.set(queueName, queue);
      logger.info(`DLQ initialized for queue: ${queueName}`, { dlqName });
    }
  }

  async moveToDeadLetterQueue(
    queueName: string,
    job: Job,
    error: Error,
  ): Promise<void> {
    const dlqQueue = this.dlqQueues.get(queueName);
    if (!dlqQueue) {
      logger.error('DLQ queue not found', { queueName });
      return;
    }

    try {
      const dlqJobData: DLQJob = {
        jobId: job.id || 'unknown',
        queueName,
        jobName: job.name,
        data: job.data,
        error: error.message,
        failedAttempts: job.attemptsMade || 0,
        timestamp: new Date().toISOString(),
      };

      await dlqQueue.add(`dlq-${job.name}`, dlqJobData, {
        attempts: 1,
        removeOnComplete: {
          age: 2592000,
        },
      });

      logger.warn('Job moved to DLQ', {
        jobId: job.id,
        queueName,
        jobName: job.name,
        failedAttempts: job.attemptsMade,
        error: error.message,
      });
    } catch (err) {
      logger.error('Failed to move job to DLQ', {
        jobId: job.id,
        queueName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getDLQStats(queueName: string): Promise<{
    count: number;
    oldestJob?: DLQJob;
    newestJob?: DLQJob;
  }> {
    const dlqQueue = this.dlqQueues.get(queueName);
    if (!dlqQueue) {
      return { count: 0 };
    }

    try {
      const jobs = await dlqQueue.getJobs(['active'], 0, 100);
      if (jobs.length === 0) {
        return { count: 0 };
      }

      const jobDatas: DLQJob[] = jobs
        .filter((j) => j.data)
        .map((j) => j.data as DLQJob);

      return {
        count: jobDatas.length,
        oldestJob: jobDatas[jobDatas.length - 1],
        newestJob: jobDatas[0],
      };
    } catch (err) {
      logger.error('Failed to get DLQ stats', {
        queueName,
        error: err instanceof Error ? err.message : String(err),
      });
      return { count: 0 };
    }
  }

  async clearDLQ(queueName: string): Promise<number> {
    const dlqQueue = this.dlqQueues.get(queueName);
    if (!dlqQueue) {
      return 0;
    }

    try {
      const count = await dlqQueue.clean(0, 100000, 'active');
      logger.info('DLQ cleared', { queueName, count });
      return count;
    } catch (err) {
      logger.error('Failed to clear DLQ', {
        queueName,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }

  async close(): Promise<void> {
    for (const queue of this.dlqQueues.values()) {
      await queue.close();
    }
  }
}

export const deadLetterQueueService = new DeadLetterQueueService();
