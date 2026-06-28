import { PayrollScheduleService } from '../../services/payrollScheduleService.js';
import { PayrollSchedulerService } from '../../services/payrollSchedulerService.js';

jest.mock('../../config/database.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('../../config/queue.js', () => ({
  redisConnection: { url: 'redis://localhost:6379' },
  PAYROLL_QUEUE_NAME: 'payroll-processing',
  SCHEDULER_QUEUE_NAME: 'payroll-scheduler',
}));

jest.mock('../../services/payrollQueueService.js', () => ({
  PayrollQueueService: {
    addPayrollJob: jest.fn().mockResolvedValue('job-123'),
  },
}));

jest.mock('../../services/payrollBonusService.js', () => ({
  PayrollBonusService: {
    createPayrollRun: jest.fn().mockResolvedValue({ id: 1, batch_id: 'BATCH-001' }),
    addBaseSalaryItem: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { pool } = require('../../config/database.js');

describe('PayrollScheduleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCronForFrequency', () => {
    it('should return weekly cron expression', () => {
      const cron = PayrollScheduleService.getCronForFrequency('weekly');
      expect(cron).toBe('0 9 * * 1');
    });

    it('should return monthly cron expression', () => {
      const cron = PayrollScheduleService.getCronForFrequency('monthly');
      expect(cron).toBe('0 9 1 * *');
    });

    it('should return biweekly cron expression', () => {
      const cron = PayrollScheduleService.getCronForFrequency('biweekly');
      expect(cron).toBe('0 9 * * 1');
    });

    it('should default to monthly for unknown frequency', () => {
      const cron = PayrollScheduleService.getCronForFrequency('yearly');
      expect(cron).toBe('0 9 1 * *');
    });
  });

  describe('create', () => {
    it('should create a schedule with correct cron expression', async () => {
      const mockSchedule = {
        id: 1,
        organization_id: 1,
        name: 'Weekly Payroll',
        frequency: 'weekly',
        cron_expression: '0 9 * * 1',
        timezone: 'UTC',
        asset_code: 'XLM',
        is_active: true,
      };

      pool.query.mockResolvedValue({ rows: [mockSchedule] });

      const result = await PayrollScheduleService.create({
        organization_id: 1,
        name: 'Weekly Payroll',
        frequency: 'weekly',
      });

      expect(result).toEqual(mockSchedule);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payroll_schedules'),
        [1, 'Weekly Payroll', 'weekly', '0 9 * * 1', 'UTC', 'XLM']
      );
    });

    it('should use custom timezone when provided', async () => {
      pool.query.mockResolvedValue({ rows: [{}] });

      await PayrollScheduleService.create({
        organization_id: 1,
        name: 'Monthly Payroll',
        frequency: 'monthly',
        timezone: 'Africa/Lagos',
        asset_code: 'USDC',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payroll_schedules'),
        [1, 'Monthly Payroll', 'monthly', '0 9 1 * *', 'Africa/Lagos', 'USDC']
      );
    });
  });

  describe('hasRunToday', () => {
    it('should return true when a run exists today', async () => {
      pool.query.mockResolvedValue({ rows: [{ count: '1' }] });
      const result = await PayrollScheduleService.hasRunToday(1);
      expect(result).toBe(true);
    });

    it('should return false when no run exists today', async () => {
      pool.query.mockResolvedValue({ rows: [{ count: '0' }] });
      const result = await PayrollScheduleService.hasRunToday(1);
      expect(result).toBe(false);
    });
  });

  describe('recordMissedRun', () => {
    it('should increment missed_runs_count', async () => {
      pool.query.mockResolvedValue({ rowCount: 1 });
      await PayrollScheduleService.recordMissedRun(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('missed_runs_count = missed_runs_count + 1'),
        [1]
      );
    });
  });
});

describe('PayrollSchedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processScheduledRun', () => {
    it('should skip if schedule is not active', async () => {
      jest.spyOn(PayrollScheduleService, 'getById').mockResolvedValue(null);

      await PayrollSchedulerService.processScheduledRun({
        scheduleId: 1,
        organizationId: 1,
        scheduledAt: new Date().toISOString(),
      });

      expect(PayrollBonusService.createPayrollRun).not.toHaveBeenCalled();
    });

    it('should skip if already ran today (idempotency)', async () => {
      jest.spyOn(PayrollScheduleService, 'getById').mockResolvedValue({
        id: 1,
        organization_id: 1,
        name: 'Weekly',
        frequency: 'weekly',
        cron_expression: '0 9 * * 1',
        timezone: 'UTC',
        asset_code: 'XLM',
        is_active: true,
        last_run_at: new Date(),
        next_run_at: null,
        missed_runs_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
      jest.spyOn(PayrollScheduleService, 'hasRunToday').mockResolvedValue(true);

      await PayrollSchedulerService.processScheduledRun({
        scheduleId: 1,
        organizationId: 1,
        scheduledAt: new Date().toISOString(),
      });

      expect(PayrollBonusService.createPayrollRun).not.toHaveBeenCalled();
    });

    it('should create payroll run and enqueue job when valid', async () => {
      jest.spyOn(PayrollScheduleService, 'getById').mockResolvedValue({
        id: 1,
        organization_id: 1,
        name: 'Weekly',
        frequency: 'weekly',
        cron_expression: '0 9 * * 1',
        timezone: 'UTC',
        asset_code: 'XLM',
        is_active: true,
        last_run_at: null,
        next_run_at: null,
        missed_runs_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
      jest.spyOn(PayrollScheduleService, 'hasRunToday').mockResolvedValue(false);
      jest.spyOn(PayrollScheduleService, 'recordRun').mockResolvedValue();

      pool.query.mockResolvedValue({
        rows: [{ id: 1, salary: '5000' }, { id: 2, salary: '3000' }],
      });

      await PayrollSchedulerService.processScheduledRun({
        scheduleId: 1,
        organizationId: 1,
        scheduledAt: new Date().toISOString(),
      });

      expect(PayrollBonusService.createPayrollRun).toHaveBeenCalled();
      expect(PayrollBonusService.addBaseSalaryItem).toHaveBeenCalledTimes(2);
      expect(PayrollQueueService.addPayrollJob).toHaveBeenCalled();
      expect(PayrollScheduleService.recordRun).toHaveBeenCalledWith(1);
    });
  });
});
