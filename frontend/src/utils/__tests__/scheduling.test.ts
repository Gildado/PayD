import { describe, expect, it } from 'vitest';
import {
  clampDayOfMonth,
  computeNextRunDate,
  generatePreviewDates,
  getLocalTimezoneLabel,
  validateSchedulingConfig,
  type SchedulingConfig,
} from '../scheduling';

// Use a fixed timezone in tests for consistent DST and date calculations
process.env.TZ = 'America/New_York';

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

  describe('table-driven tests: monthly on the 31st and month ends', () => {
    const monthEndCases = [
      { year: 2026, month: 0, monthName: 'January', expectedLastDay: 31 },
      { year: 2026, month: 1, monthName: 'February (non-leap)', expectedLastDay: 28 },
      { year: 2026, month: 2, monthName: 'March', expectedLastDay: 31 },
      { year: 2026, month: 3, monthName: 'April', expectedLastDay: 30 },
      { year: 2026, month: 4, monthName: 'May', expectedLastDay: 31 },
      { year: 2026, month: 5, monthName: 'June', expectedLastDay: 30 },
      { year: 2026, month: 6, monthName: 'July', expectedLastDay: 31 },
      { year: 2026, month: 7, monthName: 'August', expectedLastDay: 31 },
      { year: 2026, month: 8, monthName: 'September', expectedLastDay: 30 },
      { year: 2026, month: 9, monthName: 'October', expectedLastDay: 31 },
      { year: 2026, month: 10, monthName: 'November', expectedLastDay: 30 },
      { year: 2026, month: 11, monthName: 'December', expectedLastDay: 31 },
    ];

    it.each(monthEndCases)(
      'clamps day 31 correctly for $monthName $year to $expectedLastDay',
      ({ year, month, expectedLastDay }) => {
        expect(clampDayOfMonth(year, month, 31)).toBe(expectedLastDay);
      }
    );

    it('generates 12 consecutive monthly preview dates for day 31 without skipping months', () => {
      const config: SchedulingConfig = {
        frequency: 'monthly',
        dayOfMonth: 31,
        timeOfDay: '10:00',
        preferences: [],
      };

      const from = new Date(2026, 0, 1, 0, 0, 0); // Jan 1, 2026
      const previews = generatePreviewDates(config, 12, from);

      expect(previews).toHaveLength(12);

      const expectedDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      previews.forEach((date, index) => {
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(index);
        expect(date.getDate()).toBe(expectedDays[index]);
        expect(date.getHours()).toBe(10);
        expect(date.getMinutes()).toBe(0);
      });
    });

    it('rolls over correctly from December 31st to January of next year', () => {
      const config: SchedulingConfig = {
        frequency: 'monthly',
        dayOfMonth: 31,
        timeOfDay: '12:00',
        preferences: [],
      };

      const from = new Date(2026, 11, 31, 15, 0, 0); // After Dec 31 run time
      const nextRun = computeNextRunDate(config, from);

      expect(nextRun.getFullYear()).toBe(2027);
      expect(nextRun.getMonth()).toBe(0); // January
      expect(nextRun.getDate()).toBe(31);
      expect(nextRun.getHours()).toBe(12);
      expect(nextRun.getMinutes()).toBe(0);
    });
  });

  describe('table-driven tests: leap years and February edge cases', () => {
    const leapYearCases = [
      { year: 2020, isLeap: true, febDays: 29 },
      { year: 2024, isLeap: true, febDays: 29 },
      { year: 2025, isLeap: false, febDays: 28 },
      { year: 2026, isLeap: false, febDays: 28 },
      { year: 2028, isLeap: true, febDays: 29 },
      { year: 2000, isLeap: true, febDays: 29 }, // century leap year
      { year: 2100, isLeap: false, febDays: 28 }, // century non-leap year
    ];

    it.each(leapYearCases)(
      'clampDayOfMonth correctly evaluates February for year $year (febDays: $febDays)',
      ({ year, febDays }) => {
        expect(clampDayOfMonth(year, 1, 31)).toBe(febDays);
        expect(clampDayOfMonth(year, 1, 29)).toBe(febDays === 29 ? 29 : 28);
      }
    );

    it('schedules on Feb 29 in leap year 2024 when monthly on the 31st is requested', () => {
      const config: SchedulingConfig = {
        frequency: 'monthly',
        dayOfMonth: 31,
        timeOfDay: '08:00',
        preferences: [],
      };

      const from = new Date(2024, 0, 31, 10, 0, 0); // Jan 31, 2024 after 8am
      const nextRun = computeNextRunDate(config, from);

      expect(nextRun.getFullYear()).toBe(2024);
      expect(nextRun.getMonth()).toBe(1); // February
      expect(nextRun.getDate()).toBe(29); // Leap year 29th
    });

    it('schedules on Feb 28 in non-leap year 2025 when monthly on the 29th is requested', () => {
      const config: SchedulingConfig = {
        frequency: 'monthly',
        dayOfMonth: 29,
        timeOfDay: '08:00',
        preferences: [],
      };

      const from = new Date(2025, 0, 31, 10, 0, 0); // Jan 31, 2025
      const nextRun = computeNextRunDate(config, from);

      expect(nextRun.getFullYear()).toBe(2025);
      expect(nextRun.getMonth()).toBe(1);
      expect(nextRun.getDate()).toBe(28);
    });
  });

  describe('table-driven tests: DST transitions forward and back with fixed timezone', () => {
    it('preserves scheduled time across US Eastern spring-forward DST transition (March 2026)', () => {
      // In America/New_York, DST spring forward in 2026 is Sunday, March 8 (2:00 AM -> 3:00 AM)
      const weeklyConfig: SchedulingConfig = {
        frequency: 'weekly',
        dayOfWeek: 5, // Friday
        timeOfDay: '09:00',
        preferences: [],
      };

      // From Friday March 6, 2026 at 10:00 (EST, UTC-5)
      const from = new Date(2026, 2, 6, 10, 0, 0);
      const nextRun = computeNextRunDate(weeklyConfig, from);

      // Next Friday is March 13, 2026 (EDT, UTC-4)
      expect(nextRun.getFullYear()).toBe(2026);
      expect(nextRun.getMonth()).toBe(2);
      expect(nextRun.getDate()).toBe(13);
      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getMinutes()).toBe(0);

      // Generating previews across the transition
      const previews = generatePreviewDates(weeklyConfig, 3, new Date(2026, 2, 1, 0, 0, 0));
      previews.forEach((previewDate) => {
        expect(previewDate.getHours()).toBe(9);
        expect(previewDate.getMinutes()).toBe(0);
      });
    });

    it('preserves scheduled time across US Eastern fall-back DST transition (November 2026)', () => {
      // In America/New_York, DST fall back in 2026 is Sunday, November 1 (2:00 AM -> 1:00 AM)
      const weeklyConfig: SchedulingConfig = {
        frequency: 'weekly',
        dayOfWeek: 4, // Thursday
        timeOfDay: '14:30',
        preferences: [],
      };

      // From Thursday Oct 29, 2026 at 16:00 (EDT, UTC-4)
      const from = new Date(2026, 9, 29, 16, 0, 0);
      const nextRun = computeNextRunDate(weeklyConfig, from);

      // Next Thursday is Nov 5, 2026 (EST, UTC-5)
      expect(nextRun.getFullYear()).toBe(2026);
      expect(nextRun.getMonth()).toBe(10);
      expect(nextRun.getDate()).toBe(5);
      expect(nextRun.getHours()).toBe(14);
      expect(nextRun.getMinutes()).toBe(30);

      // Generating previews across the transition
      const previews = generatePreviewDates(weeklyConfig, 3, new Date(2026, 9, 20, 0, 0, 0));
      previews.forEach((previewDate) => {
        expect(previewDate.getHours()).toBe(14);
        expect(previewDate.getMinutes()).toBe(30);
      });
    });

    it('preserves scheduled time for monthly schedules across DST transitions', () => {
      const monthlyConfig: SchedulingConfig = {
        frequency: 'monthly',
        dayOfMonth: 15,
        timeOfDay: '11:15',
        preferences: [],
      };

      // Preview 4 months across spring-forward (Feb, Mar, Apr, May 2026)
      const previews = generatePreviewDates(monthlyConfig, 4, new Date(2026, 1, 1, 0, 0, 0));
      expect(previews).toHaveLength(4);
      previews.forEach((previewDate) => {
        expect(previewDate.getDate()).toBe(15);
        expect(previewDate.getHours()).toBe(11);
        expect(previewDate.getMinutes()).toBe(15);
      });
    });
  });
});
