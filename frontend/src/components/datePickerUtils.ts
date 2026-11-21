/**
 * Pure date helpers for AccessibleDatePicker. Dates are local-calendar
 * `YYYY-MM-DD` strings, which compare correctly as plain strings.
 */

export interface DateRange {
  /** First day of the range (YYYY-MM-DD), or '' when not chosen yet. */
  start: string;
  /** Last day of the range (YYYY-MM-DD), inclusive, or '' when not chosen yet. */
  end: string;
}

export const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

/** Weekday of the 1st of the month (0 = Sunday … 6 = Saturday). */
export const getFirstDayOfMonth = (year: number, month: number): number =>
  new Date(year, month, 1).getDay();

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(year, month - 1, day);
};

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2024-02-30). */
export const isValidDate = (dateStr: string): boolean => {
  if (!dateStr || dateStr.length !== 10) return false;
  const date = parseDate(dateStr);
  if (!date) return false;
  return formatDate(date) === dateStr;
};

export const addDays = (dateStr: string, days: number): string => {
  const date = parseDate(dateStr)!;
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

/** Same day-of-month in another month, clamped to that month's last day (Jan 31 + 1 → Feb 28/29). */
export const addMonths = (dateStr: string, months: number): string => {
  const date = parseDate(dateStr)!;
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const day = Math.min(date.getDate(), getDaysInMonth(target.getFullYear(), target.getMonth()));
  return formatDate(new Date(target.getFullYear(), target.getMonth(), day));
};

/** The given day-of-month in year/month, clamped to the month's length. */
export const dateInMonth = (year: number, month: number, day: number): string =>
  formatDate(new Date(year, month, Math.min(day, getDaysInMonth(year, month))));

export const startOfWeek = (dateStr: string): string =>
  addDays(dateStr, -parseDate(dateStr)!.getDay());

export const endOfWeek = (dateStr: string): string =>
  addDays(dateStr, 6 - parseDate(dateStr)!.getDay());

export const clampDate = (dateStr: string, minDate?: string, maxDate?: string): string => {
  if (minDate && dateStr < minDate) return minDate;
  if (maxDate && dateStr > maxDate) return maxDate;
  return dateStr;
};

export const isOutOfBounds = (dateStr: string, minDate?: string, maxDate?: string): boolean =>
  Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate));

/** Inclusive at both ends. */
export const isWithin = (dateStr: string, start: string, end: string): boolean =>
  dateStr >= start && dateStr <= end;

/**
 * The range after the user picks `date` in the calendar:
 * - with exactly one end chosen, `date` completes the range, ordered so start ≤ end
 *   (picking an "end" before the start swaps them);
 * - otherwise (nothing chosen, or a complete range), `date` starts a new range.
 */
export const applyRangeSelection = (range: DateRange, date: string): DateRange => {
  const anchor =
    range.start && !range.end ? range.start : !range.start && range.end ? range.end : '';
  if (!anchor) return { start: date, end: '' };
  return date < anchor ? { start: date, end: anchor } : { start: anchor, end: date };
};
