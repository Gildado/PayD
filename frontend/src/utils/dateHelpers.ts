export function parseDateString(dateString: string): Date | null {
  if (!dateString) return null;

  // `new Date('YYYY-MM-DD')` is interpreted as UTC by the JS spec, which can produce
  // off-by-one dates when rendered in local timezones. Date-only inputs in the UI
  // should be treated as local calendar dates.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  const parsed = dateOnlyMatch
    ? new Date(
        Number.parseInt(dateOnlyMatch[1], 10),
        Number.parseInt(dateOnlyMatch[2], 10) - 1,
        Number.parseInt(dateOnlyMatch[3], 10)
      )
    : new Date(dateString);

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';

  const date = parseDateString(dateString);
  if (!date) return dateString;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getRemainingDays(targetDate: string | Date): number {
  const target =
    typeof targetDate === 'string' ? (parseDateString(targetDate) ?? new Date('')) : targetDate;
  if (isNaN(target.getTime())) return 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffMs = startOfTarget.getTime() - startOfToday.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
