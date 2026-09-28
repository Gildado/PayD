import { Worker, Job } from 'bullmq';
import { redisConnection, SCHEDULER_QUEUE_NAME } from '../config/queue.js';
import { SchedulerJobData, PayrollSchedulerService } from '../services/payrollSchedulerService.js';
import { deadLetterQueueService } from '../services/deadLetterQueueService.js';
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

schedulerWorker.on('failed', async (job, err) => {
  if (!job) return;

  logger.error(
    `Scheduler job ${job.id} failed for schedule ${job.data?.scheduleId}: ${err.message}`,
    { attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts }
  );

  const maxAttempts = job.opts.attempts ?? 1;
  if ((job.attemptsMade || 0) >= maxAttempts) {
    await deadLetterQueueService.moveToDeadLetterQueue(
      SCHEDULER_QUEUE_NAME,
      job,
      err,
    );
  }
});
