import { describe, expect, it } from 'vitest';
import { formatDate, getRemainingDays } from '../../utils/dateHelpers';

describe('formatDate', () => {
  it('returns N/A for empty string', () => {
    expect(formatDate('')).toBe('N/A');
  });

  it('formats a date-only string (YYYY-MM-DD) correctly', () => {
    const result = formatDate('2024-01-15');
    expect(result).toBe('Jan 15, 2024');
  });

  it('formats an ISO datetime string correctly', () => {
    const result = formatDate('2024-06-01T10:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('Jun');
  });

  it('returns the original string for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('handles single-digit month and day', () => {
    const result = formatDate('2024-03-05');
    expect(result).toBe('Mar 5, 2024');
  });

  it('handles Dec 31 edge case', () => {
    const result = formatDate('2024-12-31');
    expect(result).toBe('Dec 31, 2024');
  });
});

describe('getRemainingDays', () => {
  it('returns 0 for an invalid date string', () => {
    expect(getRemainingDays('garbage')).toBe(0);
  });

  it('returns 0 for today', () => {
    const today = new Date();
    expect(getRemainingDays(today)).toBe(0);
  });

  it('returns a positive number for a future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(getRemainingDays(future)).toBe(10);
  });

  it('returns a negative number for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(getRemainingDays(past)).toBe(-5);
  });

  it('accepts a date string', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const iso = future.toISOString();
    expect(getRemainingDays(iso)).toBe(3);
  });

  it('uses day-level precision, not time-level', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    expect(getRemainingDays(tomorrow)).toBe(1);
  });
});
