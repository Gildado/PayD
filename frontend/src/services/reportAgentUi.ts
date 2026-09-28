// Client-side helpers backing the report agent UI entry points:
//  - #1337 freshness/staleness indicator
//  - #1338 failure alert with manual-export fallback

import {
  PAYROLL_EXPORT_COLUMNS,
  type PayrollExportColumnId,
  type PayrollTransactionRecord,
} from './customReportExport';

export type FreshnessStatus = 'fresh' | 'stale' | 'expired';

export interface FreshnessIndicator {
  status: FreshnessStatus;
  label: string;
  tone: 'success' | 'warning' | 'danger';
  description: string;
  lastGeneratedAt: Date | null;
}

const FRESH_WITHIN_MS = 60_000; // 1 minute
const STALE_WITHIN_MS = 24 * 60 * 60_000; // 24 hours

function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Derives a freshness indicator from payroll row timestamps (unix seconds).
 * Mirrors the backend report freshness service (#1337).
 */
export function computeFreshnessFromRows(
  rows: Array<Pick<PayrollTransactionRecord, 'timestamp'>>,
  now: Date = new Date()
): FreshnessIndicator {
  let latestMs: number | null = null;
  for (const row of rows) {
    const ms = row.timestamp * 1000;
    if (!Number.isFinite(ms)) continue;
    if (latestMs === null || ms > latestMs) latestMs = ms;
  }

  const base = { lastGeneratedAt: latestMs === null ? null : new Date(latestMs) };

  if (latestMs === null) {
    return {
      ...base,
      status: 'expired',
      label: 'No data',
      tone: 'danger',
      description: 'No underlying data available.',
    };
  }

  const ageMs = Math.max(0, now.getTime() - latestMs);
  if (ageMs <= FRESH_WITHIN_MS) {
    return {
      ...base,
      status: 'fresh',
      label: 'Fresh',
      tone: 'success',
      description: `Data updated ${formatAge(ageMs)}.`,
    };
  }
  if (ageMs <= STALE_WITHIN_MS) {
    return {
      ...base,
      status: 'stale',
      label: 'Stale',
      tone: 'warning',
      description: `Last update ${formatAge(ageMs)} — consider refreshing.`,
    };
  }
  return {
    ...base,
    status: 'expired',
    label: 'Outdated',
    tone: 'danger',
    description: `Data is ${formatAge(ageMs)} old — refresh before trusting this export.`,
  };
}

/** Escapes a CSV cell value (quotes, commas, newlines). */
function escapeCsvCell(value: string): string {
  const needsQuoting =
    value.includes('"') || value.includes(',') || value.includes('\n');
  if (!needsQuoting) return value;
  return `"${value.split('"').join('""')}"`;
}

/**
 * Builds a manual-export CSV client-side from the currently loaded preview
 * rows. This is the #1338 fallback path used when the backend report agent
 * fails, so operators are never blocked from getting their data.
 */
export function buildManualExportCsv(
  rows: PayrollTransactionRecord[],
  columnIds: PayrollExportColumnId[]
): string {
  const columns = columnIds
    .map((id) => PAYROLL_EXPORT_COLUMNS.find((column) => column.id === id))
    .filter((column): column is (typeof PAYROLL_EXPORT_COLUMNS)[number] => Boolean(column));

  const header = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        switch (column.id) {
          case 'employeeId':
            return escapeCsvCell(row.employeeId ?? '');
          case 'payrollBatchId':
            return escapeCsvCell(row.payrollBatchId ?? '');
          case 'amount':
            return escapeCsvCell(row.amount ?? '');
          case 'assetCode':
            return escapeCsvCell(row.assetCode ?? '');
          case 'assetIssuer':
            return escapeCsvCell(row.assetIssuer ?? '');
          case 'status':
            return row.successful ? 'Success' : 'Failed';
          case 'timestamp':
            return new Date(row.timestamp * 1000).toISOString();
          default:
            return escapeCsvCell(String(row[column.id] ?? ''));
        }
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}
