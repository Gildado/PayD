/**
 * Report freshness/staleness service (#1337).
 *
 * Computes a machine-readable freshness report for any generated report,
 * given the timestamp of the underlying data. The output is designed to be
 * rendered directly as a UI indicator badge (label + tone) or consumed by
 * monitoring tooling.
 *
 * See docs/REPORT_FRESHNESS.md for the documented output schema.
 */

export type FreshnessStatus = 'fresh' | 'stale' | 'expired';

export interface FreshnessThresholds {
  /** Data younger than this is `fresh`. */
  freshWithinMs: number;
  /** Data older than `freshWithinMs` but younger than this is `stale`; older is `expired`. */
  staleWithinMs: number;
}

export const DEFAULT_FRESHNESS_THRESHOLDS: FreshnessThresholds = {
  freshWithinMs: 60_000, // 1 minute
  staleWithinMs: 24 * 60 * 60_000, // 24 hours
};

export interface ReportFreshnessInput {
  /** Identifier of the report being evaluated, e.g. `payroll-history`. */
  reportId: string;
  /**
   * Timestamp of the most recent data backing the report.
   * `null` means no data is available at all.
   */
  lastGeneratedAt: Date | string | null;
  /** Evaluation time; defaults to now. Injectable for deterministic tests. */
  now?: Date;
  thresholds?: Partial<FreshnessThresholds>;
}

export interface ReportFreshnessReport {
  schemaVersion: '1.0';
  reportId: string;
  /** When this freshness evaluation was computed (ISO-8601). */
  evaluatedAt: string;
  /** Timestamp of the newest underlying data (ISO-8601), or null when unknown. */
  lastGeneratedAt: string | null;
  /** Milliseconds between evaluatedAt and lastGeneratedAt; null when unknown. */
  ageMs: number | null;
  status: FreshnessStatus;
  /** Ready-to-render indicator metadata for the UI. */
  indicator: {
    label: string;
    tone: 'success' | 'warning' | 'danger';
    description: string;
  };
  thresholds: FreshnessThresholds;
}

/**
 * Derives the newest data timestamp from a set of payroll transactions
 * sourced from backend services (unix seconds). Returns null for empty input.
 */
export function deriveLastGeneratedAtFromTimestamps(
  timestamps: Array<number | string | Date | null | undefined>
): Date | null {
  let latestMs: number | null = null;
  for (const value of timestamps) {
    if (value === null || value === undefined) continue;
    const ms =
      typeof value === 'number'
        ? value * 1000 // unix seconds
        : new Date(value).getTime();
    if (Number.isNaN(ms)) continue;
    if (latestMs === null || ms > latestMs) latestMs = ms;
  }
  return latestMs === null ? null : new Date(latestMs);
}

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function computeReportFreshness(
  input: ReportFreshnessInput
): ReportFreshnessReport {
  const thresholds: FreshnessThresholds = {
    ...DEFAULT_FRESHNESS_THRESHOLDS,
    ...input.thresholds,
  };
  const now = input.now ?? new Date();
  const lastGeneratedAt = input.lastGeneratedAt
    ? toIso(input.lastGeneratedAt)
    : null;
  const ageMs = lastGeneratedAt
    ? Math.max(0, now.getTime() - new Date(lastGeneratedAt).getTime())
    : null;

  let status: FreshnessStatus;
  if (ageMs === null) {
    status = 'expired';
  } else if (ageMs <= thresholds.freshWithinMs) {
    status = 'fresh';
  } else if (ageMs <= thresholds.staleWithinMs) {
    status = 'stale';
  } else {
    status = 'expired';
  }

  const indicator = {
    fresh: {
      label: 'Fresh',
      tone: 'success',
      description: lastGeneratedAt
        ? `Data updated ${formatAge(ageMs ?? 0)}.`
        : '',
    },
    stale: {
      label: 'Stale',
      tone: 'warning',
      description: lastGeneratedAt
        ? `Last update ${formatAge(ageMs ?? 0)} — consider regenerating.`
        : '',
    },
    expired: {
      label: 'No data',
      tone: 'danger',
      description:
        ageMs === null
          ? 'No underlying data available for this report.'
          : `Data is ${formatAge(ageMs)} old — regenerate before trusting this report.`,
    },
  }[status];

  return {
    schemaVersion: '1.0',
    reportId: input.reportId,
    evaluatedAt: now.toISOString(),
    lastGeneratedAt,
    ageMs,
    status,
    indicator,
    thresholds,
  };
}
