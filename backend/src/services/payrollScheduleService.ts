import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export interface PayrollSchedule {
  id: number;
  organization_id: number;
  name: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  cron_expression: string;
  timezone: string;
  asset_code: string;
  is_active: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  missed_runs_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateScheduleInput {
  organization_id: number;
  name: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  timezone?: string;
  asset_code?: string;
}

const FREQUENCY_CRON_MAP: Record<string, string> = {
  weekly: '0 9 * * 1',      // Every Monday at 9:00 AM
  biweekly: '0 9 * * 1',    // Every Monday at 9:00 AM (handled with job key)
  monthly: '0 9 1 * *',     // 1st of every month at 9:00 AM
};

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
    weekday: WEEKDAY_INDEX[weekdayLabel] ?? 0,
  };
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 4; i++) {
    const probe = new Date(utcMillis);
    const parts = getZonedDateTimeParts(probe, timeZone);
    const localizedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offsetMillis = localizedAsUtc - utcMillis;
    if (offsetMillis === 0) break;
    utcMillis -= offsetMillis;
  }

  return new Date(utcMillis);
}

function addDaysToZonedDateTime(parts: ZonedDateTimeParts, days: number, timeZone: string): Date {
  const pseudoLocal = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );
  pseudoLocal.setUTCDate(pseudoLocal.getUTCDate() + days);

  return zonedDateTimeToUtc(
    pseudoLocal.getUTCFullYear(),
    pseudoLocal.getUTCMonth() + 1,
    pseudoLocal.getUTCDate(),
    parts.hour,
    parts.minute,
    parts.second,
    timeZone
  );
}

function computeNextRunAt(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  timeZone: string,
  fromDate: Date = new Date()
): Date {
  const current = getZonedDateTimeParts(fromDate, timeZone);
  const targetHour = 9;
  const targetMinute = 0;
  const targetSecond = 0;

  if (frequency === 'monthly') {
    const isFirstOfMonth =
      current.day === 1 &&
      (current.hour < targetHour ||
        (current.hour === targetHour &&
          (current.minute < targetMinute || (current.minute === targetMinute && current.second === targetSecond))));

    const target = isFirstOfMonth
      ? current
      : {
          ...current,
          year: current.month === 12 ? current.year + 1 : current.year,
          month: current.month === 12 ? 1 : current.month + 1,
          day: 1,
        };

    return zonedDateTimeToUtc(
      target.year,
      target.month,
      target.day,
      targetHour,
      targetMinute,
      targetSecond,
      timeZone
    );
  }

  if (frequency === 'biweekly') {
    return addDaysToZonedDateTime(
      {
        ...current,
        hour: targetHour,
        minute: targetMinute,
        second: targetSecond,
      },
      14,
      timeZone
    );
  }

  const daysUntilMonday = (1 - current.weekday + 7) % 7;
  const isLaterToday =
    daysUntilMonday === 0 &&
    (current.hour > targetHour ||
      (current.hour === targetHour &&
        (current.minute > targetMinute || (current.minute === targetMinute && current.second >= targetSecond))));

  const daysToAdd = isLaterToday ? 7 : daysUntilMonday;
  const targetDate = addDaysToZonedDateTime(
    {
      ...current,
      hour: targetHour,
      minute: targetMinute,
      second: targetSecond,
    },
    daysToAdd,
    timeZone
  );

  return targetDate;
}

export class PayrollScheduleService {
  static getCronForFrequency(frequency: string): string {
    return FREQUENCY_CRON_MAP[frequency] || FREQUENCY_CRON_MAP['monthly']!;
  }

  static async create(input: CreateScheduleInput): Promise<PayrollSchedule> {
    const cronExpression = this.getCronForFrequency(input.frequency);
    const result = await pool.query(
      `INSERT INTO payroll_schedules (organization_id, name, frequency, cron_expression, timezone, asset_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.organization_id,
        input.name,
        input.frequency,
        cronExpression,
        input.timezone || 'UTC',
        input.asset_code || 'XLM',
      ]
    );
    const schedule = result.rows[0];
    const nextRunAt = computeNextRunAt(schedule.frequency, schedule.timezone);
    await this.updateNextRunAt(schedule.id, nextRunAt);
    logger.info(`Created payroll schedule "${input.name}" for org ${input.organization_id}`);
    return schedule;
  }

  static async getById(id: number): Promise<PayrollSchedule | null> {
    const result = await pool.query('SELECT * FROM payroll_schedules WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async listByOrganization(
    organizationId: number,
    activeOnly: boolean = false
  ): Promise<PayrollSchedule[]> {
    let query = 'SELECT * FROM payroll_schedules WHERE organization_id = $1';
    const params: (number | boolean)[] = [organizationId];

    if (activeOnly) {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id: number, updates: Partial<PayrollSchedule>): Promise<PayrollSchedule | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.frequency !== undefined) {
      fields.push(`frequency = $${paramIndex++}`);
      values.push(updates.frequency);
      fields.push(`cron_expression = $${paramIndex++}`);
      values.push(this.getCronForFrequency(updates.frequency));
    }
    if (updates.timezone !== undefined) {
      fields.push(`timezone = $${paramIndex++}`);
      values.push(updates.timezone);
    }
    if (updates.asset_code !== undefined) {
      fields.push(`asset_code = $${paramIndex++}`);
      values.push(updates.asset_code);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE payroll_schedules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    const schedule = result.rows[0] || null;
    if (!schedule) return null;

    const nextRunAt = computeNextRunAt(schedule.frequency, schedule.timezone);
    await this.updateNextRunAt(schedule.id, nextRunAt);
    return schedule;
  }

  static async deactivate(id: number): Promise<PayrollSchedule | null> {
    return this.update(id, { is_active: false } as any);
  }

  static async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM payroll_schedules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async recordRun(id: number, nextRunAt?: Date): Promise<void> {
    await pool.query(
      `UPDATE payroll_schedules
       SET last_run_at = NOW(), next_run_at = COALESCE($2, next_run_at), updated_at = NOW()
       WHERE id = $1`,
      [id, nextRunAt ?? null]
    );
  }

  static async recordMissedRun(id: number): Promise<void> {
    await pool.query(
      `UPDATE payroll_schedules SET missed_runs_count = missed_runs_count + 1, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  static async getActiveSchedules(): Promise<PayrollSchedule[]> {
    const result = await pool.query(
      `SELECT * FROM payroll_schedules WHERE is_active = true ORDER BY next_run_at ASC NULLS FIRST`
    );
    return result.rows;
  }

  static computeNextRunAt(
    frequency: 'weekly' | 'biweekly' | 'monthly',
    timeZone: string,
    fromDate: Date = new Date()
  ): Date {
    return computeNextRunAt(frequency, timeZone, fromDate);
  }

  static async updateNextRunAt(id: number, nextRunAt: Date): Promise<void> {
    await pool.query(
      `UPDATE payroll_schedules SET next_run_at = $2, updated_at = NOW() WHERE id = $1`,
      [id, nextRunAt]
    );
  }

  static async hasRunToday(scheduleId: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM payroll_runs pr
       JOIN payroll_schedules ps ON pr.organization_id = ps.organization_id
       WHERE ps.id = $1 AND pr.created_at >= CURRENT_DATE`,
      [scheduleId]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }
}
