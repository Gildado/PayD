interface ParseMessage {
  type: 'parse';
  content: string;
  requiredColumns: string[];
  validators: Record<string, string>;
  strictHeaderValidation: boolean;
}

interface ProgressMessage {
  type: 'progress';
  processed: number;
  total: number;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

interface CompleteMessage {
  type: 'complete';
  rows: Array<{
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
    fieldErrors: Array<{ field: string; message: string }>;
    isValid: boolean;
  }>;
}

type WorkerMessage = ParseMessage;
type ResponseMessage = ProgressMessage | ErrorMessage | CompleteMessage;

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      if (fields.length > 0) break;
      fields.push('');
      break;
    }
    if (line[i] === '"') {
      let field = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      if (i < line.length && line[i] === ',') i++;
    } else {
      const start = i;
      while (i < line.length && line[i] !== ',') i++;
      fields.push(line.slice(start, i));
      if (i < line.length) i++;
    }
  }
  return fields;
}

const CHUNK_SIZE = 500;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, content, requiredColumns, validators, strictHeaderValidation } = event.data;

  if (type !== 'parse') {
    self.postMessage({ type: 'error', error: 'Unknown message type' } as ErrorMessage);
    return;
  }

  try {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      self.postMessage({
        type: 'error',
        error: 'CSV must contain header and at least one data row',
      } as ErrorMessage);
      return;
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
      self.postMessage({
        type: 'error',
        error: `Unexpected columns: ${unknownColumns.join(', ')}`,
      } as ErrorMessage);
      return;
    }

    if (duplicateColumns.length > 0) {
      self.postMessage({
        type: 'error',
        error: `Duplicate columns: ${[...new Set(duplicateColumns)].join(', ')}`,
      } as ErrorMessage);
      return;
    }

    if (missingColumns.length > 0) {
      self.postMessage({
        type: 'error',
        error: `Missing required columns: ${missingColumns.join(', ')}`,
      } as ErrorMessage);
      return;
    }

    const rows = [];
    const totalDataRows = lines.length - 1;
    const validatorFunctions: Record<string, (value: string) => string | null> = {};

    Object.entries(validators).forEach(([field, validatorCode]) => {
      validatorFunctions[field] = new Function('value', validatorCode) as (
        value: string
      ) => string | null;
    });

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map((v) => v.trim());
      const row: Record<string, string> = {};
      const errors: string[] = [];
      const fieldErrors: Array<{ field: string; message: string }> = [];

      headers.forEach((header, idx) => {
        row[header.toLowerCase()] = values[idx] || '';
      });

      requiredColumns.forEach((col) => {
        if (!row[col]) {
          const message = `Missing required field: ${col}`;
          errors.push(message);
          fieldErrors.push({ field: col, message });
        }
      });

      Object.entries(validatorFunctions).forEach(([field, validator]) => {
        if (row[field]) {
          try {
            const error = validator(row[field]);
            if (error) {
              errors.push(error);
              fieldErrors.push({ field, message: error });
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Validation error';
            errors.push(message);
            fieldErrors.push({ field, message });
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
        self.postMessage({
          type: 'progress',
          processed,
          total: totalDataRows,
        } as ProgressMessage);
      }
    }

    self.postMessage({
      type: 'complete',
      rows,
    } as CompleteMessage);
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to parse CSV',
    } as ErrorMessage);
  }
};
