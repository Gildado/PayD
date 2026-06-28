import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/queue.js';
import { SCHEDULER_QUEUE_NAME, SchedulerJobData, PayrollSchedulerService } from '../services/payrollSchedulerService.js';
import logger from '../utils/logger.js';

export const schedulerWorker = new Worker<SchedulerJobData>(
  SCHEDULER_QUEUE_NAME,
  async (job: Job<SchedulerJobData>) => {
    logger.info(`Processing scheduled payroll trigger for schedule ${job.data.scheduleId}`);
    await PayrollSchedulerService.processScheduledRun(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

schedulerWorker.on('completed', (job) => {
  logger.info(`Scheduler job ${job.id} completed for schedule ${job.data.scheduleId}`);
});

schedulerWorker.on('failed', (job, err) => {
  logger.error(
    `Scheduler job ${job?.id} failed for schedule ${job?.data?.scheduleId}: ${err.message}`
  );
});
