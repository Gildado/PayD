import { describe, expect, it } from 'vitest';
import {
  computeNextRunDate,
  generatePreviewDates,
  getLocalTimezoneLabel,
  validateSchedulingConfig,
  type SchedulingConfig,
} from '../scheduling';

describe('scheduling utils', () => {
  it('clamps monthly schedules to the last day of shorter months', () => {
    const config: SchedulingConfig = {
      frequency: 'monthly',
      dayOfMonth: 31,
      timeOfDay: '09:00',
      preferences: [],
    };

    const nextRun = computeNextRunDate(config, new Date(2026, 0, 31, 13, 0, 0));

    expect(nextRun.getFullYear()).toBe(2026);
    expect(nextRun.getMonth()).toBe(1);
    expect(nextRun.getDate()).toBe(28);
    expect(nextRun.getHours()).toBe(9);
    expect(nextRun.getMinutes()).toBe(0);
  });

  it('generates biweekly preview dates with a fourteen day interval', () => {
    const from = new Date(2026, 3, 6, 8, 0, 0);
    const config: SchedulingConfig = {
      frequency: 'biweekly',
      dayOfWeek: from.getDay(),
      timeOfDay: '09:30',
      preferences: [],
    };

    const preview = generatePreviewDates(config, 3, from);

    expect(preview).toHaveLength(3);
    expect(preview[0].getHours()).toBe(9);
    expect(preview[0].getMinutes()).toBe(30);
    expect(preview[1].getTime() - preview[0].getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    expect(preview[2].getTime() - preview[1].getTime()).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('reports invalid monthly day and malformed time', () => {
    const errors = validateSchedulingConfig({
      frequency: 'monthly',
      dayOfMonth: 0,
      timeOfDay: '25:61',
      preferences: [],
    });

    expect(errors.dayOfMonth).toContain('Choose a day');
    expect(errors.timeOfDay).toContain('Enter a valid time');
  });

  it('returns a local timezone label', () => {
    expect(getLocalTimezoneLabel()).toBeTypeOf('string');
    expect(getLocalTimezoneLabel().length).toBeGreaterThan(0);
  });
});
