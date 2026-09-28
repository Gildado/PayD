import { Queue, Job } from 'bullmq';
import { redisConnection } from '../config/queue.js';
import { PayrollScheduleService } from './payrollScheduleService.js';
import { PayrollBonusService } from './payrollBonusService.js';
import { PayrollQueueService } from './payrollQueueService.js';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export const SCHEDULER_QUEUE_NAME = 'payroll-scheduler';

export interface SchedulerJobData {
  scheduleId: number;
  organizationId: number;
  scheduledAt: string;
}

export class PayrollSchedulerService {
  private static queue: Queue<SchedulerJobData> | null = null;

  static getQueue(): Queue<SchedulerJobData> {
    if (!this.queue) {
      this.queue = new Queue(SCHEDULER_QUEUE_NAME, {
        connection: redisConnection,
        defaultJobOptions: {
          removeOnComplete: { age: 86400 * 7 },
          removeOnFail: { age: 86400 * 30 },
        },
      });
    }
    return this.queue;
  }

  static async scheduleJob(scheduleId: number): Promise<void> {
    const schedule = await PayrollScheduleService.getById(scheduleId);
    if (!schedule || !schedule.is_active) {
      logger.warn(`Schedule ${scheduleId} is not active, skipping scheduling`);
      return;
    }

    const queue = this.getQueue();
    const jobKey = `schedule-${scheduleId}`;
    const nextRunAt = PayrollScheduleService.computeNextRunAt(
      schedule.frequency,
      schedule.timezone,
      new Date()
    );

    const repeat =
      schedule.frequency === 'biweekly'
        ? { every: 14 * 24 * 60 * 60 * 1000 }
        : { pattern: schedule.cron_expression, tz: schedule.timezone };

    await queue.add(
      `trigger-schedule-${scheduleId}`,
      {
        scheduleId,
        organizationId: schedule.organization_id,
        scheduledAt: new Date().toISOString(),
      },
      {
        repeat,
        jobId: jobKey,
      }
    );

    await PayrollScheduleService.updateNextRunAt(schedule.id, nextRunAt);

    logger.info(
      `Scheduled payroll job for schedule ${scheduleId} (${schedule.name}) with frequency ${schedule.frequency}`
    );
  }

  static async unscheduleJob(scheduleId: number): Promise<void> {
    const queue = this.getQueue();
    const jobKey = `schedule-${scheduleId}`;

    try {
      await queue.removeJobScheduler(jobKey);
      logger.info(`Unscheduled payroll job for schedule ${scheduleId}`);
    } catch {
      logger.warn(`Could not remove job scheduler for schedule ${scheduleId}`);
    }
  }

  static async initializeAllSchedules(): Promise<void> {
    const schedules = await PayrollScheduleService.getActiveSchedules();
    logger.info(`Initializing ${schedules.length} active payroll schedules`);

    for (const schedule of schedules) {
      try {
        await this.scheduleJob(schedule.id);
      } catch (error) {
        logger.error(`Failed to initialize schedule ${schedule.id}`, error);
      }
    }
  }

  static async processScheduledRun(data: SchedulerJobData): Promise<void> {
    const { scheduleId, organizationId } = data;
    const schedule = await PayrollScheduleService.getById(scheduleId);

    if (!schedule || !schedule.is_active) {
      logger.info(`Schedule ${scheduleId} is no longer active, skipping`);
      return;
    }

    // Idempotency check: skip if already ran today
    const alreadyRan = await PayrollScheduleService.hasRunToday(scheduleId);
    if (alreadyRan) {
      logger.info(`Schedule ${scheduleId} already ran today, skipping (idempotent)`);
      return;
    }

    // Check for missed runs
    if (schedule.last_run_at) {
      const now = new Date();
      const lastRun = new Date(schedule.last_run_at);
      const expectedInterval =
        schedule.frequency === 'weekly'
          ? 7 * 24 * 60 * 60 * 1000
          : schedule.frequency === 'biweekly'
            ? 14 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;

      const gap = now.getTime() - lastRun.getTime();
      if (gap > expectedInterval * 1.5) {
        logger.warn(
          `Schedule ${scheduleId} has missed runs. Last run: ${schedule.last_run_at}, gap: ${gap}ms`
        );
        await PayrollScheduleService.recordMissedRun(scheduleId);
      }
    }

    try {
      // Get active employees for this organization
      const employeesResult = await pool.query(
        `SELECT id, salary FROM employees 
         WHERE organization_id = $1 AND deleted_at IS NULL AND salary > 0`,
        [organizationId]
      );

      if (employeesResult.rows.length === 0) {
        logger.info(`No active employees with salary for org ${organizationId}, skipping payroll run`);
        return;
      }

      // Calculate period boundaries
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;

      if (schedule.frequency === 'monthly') {
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (schedule.frequency === 'biweekly') {
        periodEnd = new Date(now);
        periodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      } else {
        periodEnd = new Date(now);
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      // Create payroll run
      const payrollRun = await PayrollBonusService.createPayrollRun(
        organizationId,
        periodStart,
        periodEnd,
        schedule.asset_code
      );

      // Add salary items for each employee
      for (const employee of employeesResult.rows) {
        await PayrollBonusService.addBaseSalaryItem(
          payrollRun.id,
          employee.id,
          String(employee.salary)
        );
      }

      // Enqueue the payroll job for processing
      await PayrollQueueService.addPayrollJob({
        payrollRunId: payrollRun.id,
        organizationId,
      });

    // Record the run
      const nextRunAt = PayrollScheduleService.computeNextRunAt(
        schedule.frequency,
        schedule.timezone,
        new Date()
      );
      await PayrollScheduleService.recordRun(scheduleId, nextRunAt);

      logger.info(
        `Triggered scheduled payroll run ${payrollRun.id} for org ${organizationId} (schedule ${scheduleId})`
      );
    } catch (error) {
      logger.error(`Failed to process scheduled run for schedule ${scheduleId}`, error);
      throw error;
    }
  }

  static async shutdown(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }
}
