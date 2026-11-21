export type SchedulingFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface EmployeePreference {
  id: string;
  name: string;
  amount: string;
  currency: string;
}

export interface SchedulingConfig {
  frequency: SchedulingFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  preferences: EmployeePreference[];
}

export interface SchedulingValidationErrors {
  dayOfMonth?: string;
  dayOfWeek?: string;
  timeOfDay?: string;
}

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeOfDay(time: string) {
  const [hhRaw, mmRaw] = time.split(':');
  const hh = Number.parseInt(hhRaw ?? '0', 10);
  const mm = Number.parseInt(mmRaw ?? '0', 10);

  return {
    hours: Number.isFinite(hh) ? hh : 0,
    minutes: Number.isFinite(mm) ? mm : 0,
  };
}

export function clampDayOfMonth(year: number, monthIndex: number, desired: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(desired, lastDay));
}

export function validateSchedulingConfig(config: SchedulingConfig): SchedulingValidationErrors {
  const errors: SchedulingValidationErrors = {};

  if (!TIME_OF_DAY_PATTERN.test(config.timeOfDay)) {
    errors.timeOfDay = 'Enter a valid time in HH:mm format.';
  }

  if (config.frequency === 'monthly') {
    const day = config.dayOfMonth ?? 0;
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      errors.dayOfMonth = 'Choose a day between 1 and 31.';
    }
  }

  if (config.frequency !== 'monthly') {
    const day = config.dayOfWeek ?? -1;
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      errors.dayOfWeek = 'Choose a valid weekday.';
    }
  }

  return errors;
}

export function computeNextRunDate(config: SchedulingConfig, from: Date = new Date()): Date {
  const { hours, minutes } = parseTimeOfDay(config.timeOfDay);

  if (config.frequency === 'monthly') {
    const desiredDay = config.dayOfMonth || 1;

    const year = from.getFullYear();
    const monthIndex = from.getMonth();

    let candidate = new Date(
      year,
      monthIndex,
      clampDayOfMonth(year, monthIndex, desiredDay),
      hours,
      minutes,
      0,
      0
    );

    if (candidate.getTime() <= from.getTime()) {
      const nextMonthIndex = monthIndex + 1;
      const targetYear = year + Math.floor(nextMonthIndex / 12);
      const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;
      candidate = new Date(
        targetYear,
        normalizedMonth,
        clampDayOfMonth(targetYear, normalizedMonth, desiredDay),
        hours,
        minutes,
        0,
        0
      );
    }

    return candidate;
  }

  const dayOfWeek = config.dayOfWeek ?? 1;
  const diffDays = (dayOfWeek - from.getDay() + 7) % 7;

  const first = new Date(from);
  first.setDate(from.getDate() + diffDays);
  first.setHours(hours, minutes, 0, 0);

  if (diffDays === 0 && first.getTime() <= from.getTime()) {
    first.setDate(first.getDate() + 7);
    first.setHours(hours, minutes, 0, 0);
  }

  return first;
}

export function generatePreviewDates(
  config: SchedulingConfig,
  count = 5,
  from: Date = new Date()
): Date[] {
  const dates: Date[] = [];
  const firstRun = computeNextRunDate(config, from);
  const { hours, minutes } = parseTimeOfDay(config.timeOfDay);

  if (config.frequency === 'monthly') {
    const desiredDay = config.dayOfMonth || 1;
    const startYear = firstRun.getFullYear();
    const startMonth = firstRun.getMonth();

    for (let i = 0; i < count; i += 1) {
      const targetMonthIndex = startMonth + i;
      const targetYear = startYear + Math.floor(targetMonthIndex / 12);
      const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
      const clampedDay = clampDayOfMonth(targetYear, normalizedMonth, desiredDay);

      const run = new Date(targetYear, normalizedMonth, clampedDay, hours, minutes, 0, 0);
      dates.push(run);
    }

    return dates;
  }

  const stepDays = config.frequency === 'biweekly' ? 14 : 7;
  for (let i = 0; i < count; i += 1) {
    const run = new Date(firstRun);
    run.setDate(firstRun.getDate() + i * stepDays);
    run.setHours(hours, minutes, 0, 0);
    dates.push(run);
  }

  return dates;
}

export function getUTCLabel(): string {
  const now = new Date();
  const utcOffset = -now.getTimezoneOffset() / 60;
  const sign = utcOffset >= 0 ? '+' : '';
  return `UTC${sign}${utcOffset}`;
}

export function getLocalTimezoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
}
