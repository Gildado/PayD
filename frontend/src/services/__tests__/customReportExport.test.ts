import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExportHistory,
  loadExportHistory,
  MAX_CUSTOM_EXPORT_ROWS,
  recordExportHistoryEntry,
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
