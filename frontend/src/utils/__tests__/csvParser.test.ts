import { describe, expect, it, vi } from 'vitest';
import en from '../../locales/en/translation.json';
import {
  CHUNK_SIZE,
  parseCSVLine,
  toCSVField,
  formatFileSize,
  parseCSV,
  buildErrorReportCsv,
  type CSVParseOptions,
  type CSVRow,
  type CSVTranslate,
} from '../csvParser';

// Mirrors the global react-i18next mock in src/__tests__/setup.ts: look up the
// English translation, then interpolate {{vars}}.
const translate: CSVTranslate = (key, vars) => {
  const lookup = (obj: Record<string, unknown>, path: string): string | undefined => {
    const found = path.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
    return typeof found === 'string' ? found : undefined;
  };
  const values = vars && typeof vars === 'object' ? vars : undefined;
  const text = lookup(en as Record<string, unknown>, key) ?? (typeof vars === 'string' ? vars : key);
  return values
    ? Object.entries(values).reduce(
        (str, [name, value]) => str.replace(new RegExp(`{{${name}}}`, 'g'), String(value)),
        text
      )
    : text;
};

const makeCSV = (headers: string[], rows: string[][]): string =>
  [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

const options = (overrides: Partial<CSVParseOptions> = {}): CSVParseOptions => ({
  requiredColumns: ['name', 'email'],
  translate,
  ...overrides,
});

const makeRow = (overrides: Partial<CSVRow> = {}): CSVRow => ({
  rowNumber: 2,
  data: { name: 'John', email: 'john@test.com' },
  errors: [],
  fieldErrors: [],
  isValid: true,
  ...overrides,
});

describe('parseCSVLine', () => {
  it('splits an unquoted RFC 4180 line', () => {
    expect(parseCSVLine('name,email,amount')).toEqual(['name', 'email', 'amount']);
  });

  it('keeps an embedded comma inside a quoted field', () => {
    expect(parseCSVLine('"Smith, Alice",250')).toEqual(['Smith, Alice', '250']);
  });

  it('unescapes doubled double-quotes inside a quoted field', () => {
    expect(parseCSVLine('"O""Brien",100')).toEqual(['O"Brien', '100']);
  });

  it('handles multiple quoted fields and quoted commas', () => {
    expect(parseCSVLine('"one, two","three, four"')).toEqual(['one, two', 'three, four']);
  });

  it('returns a single empty field for empty input', () => {
    expect(parseCSVLine('')).toEqual(['']);
  });

  it('preserves the current trailing-comma behaviour', () => {
    expect(parseCSVLine('name,')).toEqual(['name']);
    expect(parseCSVLine('a,,')).toEqual(['a', '']);
  });
});

describe('toCSVField / formatFileSize', () => {
  it('RFC-4180 quotes values (including embedded quotes)', () => {
    expect(toCSVField('plain')).toBe('"plain"');
    expect(toCSVField('O"Brien')).toBe('"O""Brien"');
    expect(toCSVField('')).toBe('""');
  });

  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(50 * 1024 * 1024)).toBe('50.0 MB');
  });
});

describe('parseCSV', () => {
  it('parses valid rows with lower-cased data keys and 1-based row numbers', async () => {
    const result = await parseCSV(
      makeCSV(['name', 'email'], [['John', 'john@test.com'], ['Jane', 'jane@test.com']]),
      options()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      data: { name: 'John', email: 'john@test.com' },
      errors: [],
      fieldErrors: [],
      isValid: true,
    });
    expect(result.rows[1].rowNumber).toBe(3);
  });

  it('trims headers/values and matches required columns case-insensitively', async () => {
    const result = await parseCSV(' Name , EMAIL \n John , john@test.com ', options());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].data).toEqual({ name: 'John', email: 'john@test.com' });
    expect(result.rows[0].isValid).toBe(true);
  });

  it('rejects content with no header and data row', async () => {
    const result = await parseCSV('', options());
    expect(result).toEqual({
      ok: false,
      error: 'The CSV file must contain a header row and at least one data row.',
    });
  });

  it('rejects unexpected columns when strict validation is on', async () => {
    const result = await parseCSV(makeCSV(['name', 'email', 'extra'], [['John', 'j', 'x']]), options());
    expect(result).toEqual({ ok: false, error: 'Unexpected columns found: extra' });
  });

  it('allows unexpected columns when strict validation is off', async () => {
    const result = await parseCSV(makeCSV(['name', 'email', 'extra'], [['John', 'j', 'x']]), options({
      strictHeaderValidation: false,
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].data.name).toBe('John');
  });

  it('rejects duplicate columns (deduplicated in the message)', async () => {
    const result = await parseCSV(
      makeCSV(['name', 'name', 'email'], [['John', 'Smith', 'john@test.com']]),
      options()
    );
    expect(result).toEqual({ ok: false, error: 'Duplicate columns found: name' });
  });

  it('rejects missing required columns', async () => {
    const result = await parseCSV(makeCSV(['name'], [['John']]), options());
    expect(result).toEqual({ ok: false, error: 'Missing required columns: email' });
  });

  it('reports missing required fields as both errors and fieldErrors', async () => {
    const result = await parseCSV(makeCSV(['name', 'email'], [['John', ''], ['', 'jane@test.com']]), options());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].isValid).toBe(false);
    expect(result.rows[0].errors).toEqual(['Missing required field: email']);
    expect(result.rows[0].fieldErrors).toEqual([
      { field: 'email', message: 'Missing required field: email' },
    ]);
    expect(result.rows[1].fieldErrors).toEqual([
      { field: 'name', message: 'Missing required field: name' },
    ]);
  });

  it('runs custom validators on non-empty values and records field errors', async () => {
    const validators = {
      amount: (value: string) => (Number(value) < 100 ? 'Amount must be at least 100' : null),
    };
    const result = await parseCSV(
      makeCSV(['name', 'email', 'amount'], [['John', 'john@test.com', '50']]),
      options({ requiredColumns: ['name', 'email', 'amount'], validators })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].isValid).toBe(false);
    expect(result.rows[0].fieldErrors).toEqual([
      { field: 'amount', message: 'Amount must be at least 100' },
    ]);
    expect(result.rows[0].errors).toContain('Amount must be at least 100');
  });

  it('does not run validators on empty values', async () => {
    const validator = (value: string) => `${value} rejected`;
    const result = await parseCSV(
      makeCSV(['name', 'email', 'amount'], [['John', 'john@test.com', '']]),
      options({ validators: { amount: validator }, strictHeaderValidation: false })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].isValid).toBe(true);
    expect(result.rows[0].fieldErrors).toEqual([]);
  });

  it('reports progress at chunk boundaries and once at the end', async () => {
    const total = CHUNK_SIZE + 1;
    const rows = Array.from({ length: total }, (_, i) => [`User${i}`, `user${i}@test.com`]);
    const onProgress = vi.fn();

    const result = await parseCSV(makeCSV(['name', 'email'], rows), options({ onProgress }));

    expect(result.ok).toBe(true);
    expect(onProgress).toHaveBeenCalledWith(CHUNK_SIZE, total);
    expect(onProgress).toHaveBeenLastCalledWith(total, total);
  });

  it('parses RFC 4180 rows through the full pipeline', async () => {
    const result = await parseCSV('name,email\n"O""Brien","o,brien@test.com"', options());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].data.name).toBe('O"Brien');
    expect(result.rows[0].data.email).toBe('o,brien@test.com');
    expect(result.rows[0].isValid).toBe(true);
  });
});

describe('buildErrorReportCsv', () => {
  it('returns null when every row is valid', () => {
    expect(buildErrorReportCsv([makeRow()], translate)).toBeNull();
  });

  it('exports only invalid rows with quoted header/values and an unquoted row number', () => {
    const rows = [
      makeRow(),
      makeRow({
        rowNumber: 3,
        data: { name: '', email: 'jane@test.com' },
        errors: ['Missing required field: name'],
        fieldErrors: [{ field: 'name', message: 'Missing required field: name' }],
        isValid: false,
      }),
    ];

    const csv = buildErrorReportCsv(rows, translate);

    expect(csv).toContain('"Row Number","name","email","Errors"');
    expect(csv).toContain('3,"","jane@test.com","Missing required field: name"');
    expect(csv).not.toContain('"John"');
    expect(csv).not.toContain('"john@test.com"');
  });

  it('escapes embedded quotes in error-report values', () => {
    const rows = [
      makeRow({
        rowNumber: 4,
        data: { name: 'O"Brien', email: '' },
        errors: ['first; second'],
        isValid: false,
      }),
    ];

    const csv = buildErrorReportCsv(rows, translate);

    expect(csv).toContain('"O""Brien"');
    expect(csv).toContain('"first; second"');
  });

  it('joins multiple row errors with "; "', () => {
    const rows = [
      makeRow({ data: { name: '', email: '' }, errors: ['a', 'b'], isValid: false }),
    ];

    expect(buildErrorReportCsv(rows, translate)).toContain('"a; b"');
  });
});
