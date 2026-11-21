import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExportHistory,
  EXPORT_DEFAULTS_STORAGE_KEY,
  loadExportDefaults,
  loadExportHistory,
  MAX_CUSTOM_EXPORT_ROWS,
  PAYROLL_EXPORT_COLUMNS,
  recordExportHistoryEntry,
  saveExportDefaults,
  type ExportHistoryEntry,
} from '../customReportExport';

function baseEntry(
  overrides: Partial<Omit<ExportHistoryEntry, 'id' | 'exportedAt'>> = {}
): Omit<ExportHistoryEntry, 'id' | 'exportedAt'> {
  return {
    filename: 'payroll-custom-2026-01-01.csv',
    format: 'csv',
    rowCount: 42,
    columns: ['txHash', 'amount'],
    organizationPublicKey: 'GORG',
    ...overrides,
  };
}

describe('customReportExport history', () => {
  beforeEach(() => {
    clearExportHistory();
  });

  it('starts empty', () => {
    expect(loadExportHistory()).toEqual([]);
  });

  it('records an entry with a generated id and timestamp', () => {
    const [entry] = recordExportHistoryEntry(baseEntry());
    expect(entry.id).toBeTruthy();
    expect(entry.exportedAt).toBeTruthy();
    expect(entry.filename).toBe('payroll-custom-2026-01-01.csv');
  });

  it('persists entries across loads', () => {
    recordExportHistoryEntry(baseEntry());
    expect(loadExportHistory()).toHaveLength(1);
  });

  it('orders newest first', () => {
    recordExportHistoryEntry(baseEntry({ filename: 'first.csv' }));
    recordExportHistoryEntry(baseEntry({ filename: 'second.csv' }));
    const history = loadExportHistory();
    expect(history[0].filename).toBe('second.csv');
    expect(history[1].filename).toBe('first.csv');
  });

  it('caps history at 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      recordExportHistoryEntry(baseEntry({ filename: `export-${i}.csv` }));
    }
    const history = loadExportHistory();
    expect(history).toHaveLength(10);
    expect(history[0].filename).toBe('export-14.csv');
  });

  it('clears all history', () => {
    recordExportHistoryEntry(baseEntry());
    clearExportHistory();
    expect(loadExportHistory()).toEqual([]);
  });

  it('exposes the shared row cap used for the size-limit warning', () => {
    expect(MAX_CUSTOM_EXPORT_ROWS).toBe(10_000);
  });
});

describe('export defaults and remembered preferences', () => {
  beforeEach(() => {
    localStorage.removeItem(EXPORT_DEFAULTS_STORAGE_KEY);
  });

  it('loads default format and columns when no preference is saved', () => {
    const defaults = loadExportDefaults();
    expect(defaults.format).toBe('csv');
    expect(defaults.columns).toHaveLength(PAYROLL_EXPORT_COLUMNS.length);
  });

  it('saves and remembers custom column and format selections', () => {
    saveExportDefaults({
      format: 'pdf',
      columns: ['txHash', 'amount', 'timestamp'],
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    const remembered = loadExportDefaults();
    expect(remembered.format).toBe('pdf');
    expect(remembered.columns).toEqual(['txHash', 'amount', 'timestamp']);
    expect(remembered.startDate).toBe('2026-01-01');
    expect(remembered.endDate).toBe('2026-01-31');
  });

  it('preserves existing defaults when updating partial preferences', () => {
    saveExportDefaults({
      format: 'excel',
      columns: ['txHash', 'status'],
    });

    saveExportDefaults({
      format: 'csv',
    });

    const remembered = loadExportDefaults();
    expect(remembered.format).toBe('csv');
    expect(remembered.columns).toEqual(['txHash', 'status']);
  });
});
