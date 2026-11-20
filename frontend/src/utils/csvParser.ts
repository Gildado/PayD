/**
 * Pure CSV parsing/validation utilities used by `CSVUploader`.
 *
 * This module intentionally has no React or DOM dependencies so the parsing
 * rules can be unit tested in isolation and reused (e.g. by a worker).
 */

/** Maximum accepted upload size (50 MB). */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Rows are validated in chunks so large files don't block the UI thread. */
export const CHUNK_SIZE = 500;

/** Share of the progress bar given to reading the file; validation fills the rest. */
export const READ_PHASE_WEIGHT = 30;

/** Preview filter selected by the user. */
export type CSVRowFilter = 'all' | 'valid' | 'invalid';

export interface CSVFieldError {
  field: string;
  message: string;
}

export interface CSVRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  fieldErrors: CSVFieldError[];
  isValid: boolean;
}

/**
 * Minimal shape of the i18next translator. Injected so this module can build
 * the exact same (translated) messages as the component without importing
 * React or i18next.
 */
export type CSVTranslate = (
  key: string,
  vars?: Record<string, string | number> | string
) => string;

export interface CSVParseOptions {
  requiredColumns: string[];
  validators?: Record<string, (value: string) => string | null>;
  strictHeaderValidation?: boolean;
  translate: CSVTranslate;
  onProgress?: (processed: number, total: number) => void;
}

export type CSVParseResult =
  | { ok: true; rows: CSVRow[] }
  | { ok: false; error: string };

/**
 * Parse a single RFC 4180 CSV line into an array of field values.
 * Handles quoted fields, embedded commas, and escaped double-quotes ("").
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      // Trailing comma: push empty field
      if (fields.length > 0) break;
      fields.push('');
      break;
    }
    if (line[i] === '"') {
      // Quoted field
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // Escaped double-quote
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      if (i < line.length && line[i] === ',') i++; // skip comma
    } else {
      // Unquoted field: read until comma or end
      const start = i;
      while (i < line.length && line[i] !== ',') i++;
      fields.push(line.slice(start, i));
      if (i < line.length) i++; // skip comma
    }
  }
  return fields;
}

/** Quote a value for the exported error report (RFC 4180). */
export function toCSVField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Parse and validate CSV content.
 *
 * Returns a discriminated result instead of mutating any component state.
 * Progress is reported in chunks, yielding to the event loop between chunks
 * so the browser can paint while large files are validated.
 */
export async function parseCSV(
  content: string,
  options: CSVParseOptions
): Promise<CSVParseResult> {
  const {
    requiredColumns,
    validators = {},
    strictHeaderValidation = true,
    translate,
    onProgress,
  } = options;

  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    return { ok: false, error: translate('csvUploader.errorMissingHeaderOrData') };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());

  const normalizedHeaders = headers.map((h) => h.toLowerCase());
  const normalizedRequired = requiredColumns.map((col) => col.toLowerCase());

  const missingColumns = requiredColumns.filter(
    (col) => !normalizedHeaders.includes(col.toLowerCase())
  );

  const unknownColumns = headers.filter(
    (header) => !normalizedRequired.includes(header.toLowerCase())
  );

  const duplicateColumns = headers.filter(
    (header, index) =>
      normalizedHeaders.indexOf(header.toLowerCase()) !== index && header.trim().length > 0
  );

  if (strictHeaderValidation && unknownColumns.length > 0) {
    return {
      ok: false,
      error: translate('csvUploader.errorUnexpectedColumns', {
        columns: unknownColumns.join(', '),
      }),
    };
  }

  if (duplicateColumns.length > 0) {
    return {
      ok: false,
      error: translate('csvUploader.errorDuplicateColumns', {
        columns: [...new Set(duplicateColumns)].join(', '),
      }),
    };
  }

  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: translate('csvUploader.errorMissingColumns', { columns: missingColumns.join(', ') }),
    };
  }

  const rows: CSVRow[] = [];
  const totalDataRows = lines.length - 1;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map((v) => v.trim());
    const row: Record<string, string> = {};
    const errors: string[] = [];
    const fieldErrors: CSVFieldError[] = [];

    headers.forEach((header, idx) => {
      row[header.toLowerCase()] = values[idx] || '';
    });

    requiredColumns.forEach((col) => {
      if (!row[col]) {
        const message = translate('csvUploader.errorMissingField', { field: col });
        errors.push(message);
        fieldErrors.push({ field: col, message });
      }
    });

    Object.entries(validators).forEach(([field, validator]) => {
      if (row[field]) {
        const error = validator(row[field]);
        if (error) {
          errors.push(error);
          fieldErrors.push({ field, message: error });
        }
      }
    });

    rows.push({
      rowNumber: i + 1,
      data: row,
      errors,
      fieldErrors,
      isValid: errors.length === 0,
    });

    const processed = i;
    if (processed % CHUNK_SIZE === 0 && processed < totalDataRows) {
      onProgress?.(processed, totalDataRows);
      // Yield to the browser so it can paint/respond to input before the next chunk.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.(totalDataRows, totalDataRows);
  return { ok: true, rows };
}

/**
 * Build the error-report CSV text for the rows that failed validation.
 * Returns `null` when there are no errors to export (matching the component's
 * original early-return behaviour).
 *
 * Quoting mirrors the original report: the header and every data/error value
 * are RFC-4180 quoted, while the row number is written verbatim.
 */
export function buildErrorReportCsv(rows: CSVRow[], translate: CSVTranslate): string | null {
  const errorRows = rows.filter((r) => !r.isValid);
  if (errorRows.length === 0) return null;

  const columns = [
    translate('csvUploader.columnRowNumber'),
    ...Object.keys(rows[0]?.data || {}),
    translate('csvUploader.columnErrors'),
  ];

  return [
    columns.map(toCSVField).join(','),
    ...errorRows.map((row) =>
      [
        row.rowNumber.toString(),
        ...Object.values(row.data).map(toCSVField),
        toCSVField(row.errors.join('; ')),
      ].join(',')
    ),
  ].join('\n');
}
