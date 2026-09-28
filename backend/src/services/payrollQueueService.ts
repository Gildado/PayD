import { Queue } from 'bullmq';
import { redisConnection, PAYROLL_QUEUE_NAME } from '../config/queue.js';
import { generateCorrelationId, getCorrelationId } from '../utils/correlationContext.js';
import logger from '../utils/logger.js';

export interface PayrollJobData {
  payrollRunId: number;
  organizationId: number;
  /** Propagated from the originating HTTP request so all worker log entries share the same correlation ID. */
  correlationId?: string;
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
      // Carry the caller's correlation ID (or generate a fresh one) into the job payload
      // so the worker can restore it and all log lines share a single traceable ID.
      const jobData: PayrollJobData = {
        ...data,
        correlationId: data.correlationId ?? getCorrelationId() ?? generateCorrelationId(),
      };
      const job = await queue.add(`payroll-run-${data.payrollRunId}`, jobData);
      logger.info(`Added payroll job ${job.id} for run ${data.payrollRunId}`, {
        correlationId: jobData.correlationId,
      });
      return job.id!;
    } catch (error) {
      logger.error('Failed to add payroll job to queue', error);
      throw error;
    }
  }
}
