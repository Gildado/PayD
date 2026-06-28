import { Queue } from 'bullmq';
import { redisConnection, PAYROLL_QUEUE_NAME } from '../config/queue.js';
import logger from '../utils/logger.js';

export interface PayrollJobData {
  payrollRunId: number;
  organizationId: number;
}

export class PayrollQueueService {
  private static queue: Queue | null = null;

  static getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(PAYROLL_QUEUE_NAME, {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      });
    }
    return this.queue;
  }

  static async addPayrollJob(data: PayrollJobData): Promise<string> {
    try {
      const queue = this.getQueue();
      const job = await queue.add(`payroll-run-${data.payrollRunId}`, data);
      logger.info(`Added payroll job ${job.id} for run ${data.payrollRunId}`);
      return job.id!;
    } catch (error) {
      logger.error('Failed to add payroll job to queue', error);
      throw error;
    }
  }
}
