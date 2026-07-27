import React, { useState, useRef, useCallback, useId } from 'react';
import {
  Upload,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Loader2,
  Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
// Rows are validated in chunks with a yield to the event loop in between, so
// large files (up to MAX_FILE_SIZE) don't block the UI thread while parsing.
const CHUNK_SIZE = 500;

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

interface CSVUploaderProps {
  requiredColumns: string[];
  onDataParsed: (data: CSVRow[]) => void;
  validators?: Record<string, (value: string) => string | null>;
  strictHeaderValidation?: boolean;
}

/**
 * Parse a single RFC 4180 CSV line into an array of field values.
 * Handles quoted fields, embedded commas, and escaped double-quotes ("").
 */
function parseCSVLine(line: string): string[] {
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

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  requiredColumns,
  onDataParsed,
  validators = {},
  strictHeaderValidation = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useNotification();
  const errorId = useId();
  const descriptionId = useId();

  const parseCSV = useCallback(
    async (
      content: string,
      onProgress?: (processed: number, total: number) => void
    ): Promise<CSVRow[] | null> => {
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        setParseError(t('csvUploader.errorMissingHeaderOrData'));
        return null;
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
        setParseError(
          t('csvUploader.errorUnexpectedColumns', { columns: unknownColumns.join(', ') })
        );
        return null;
      }

      if (duplicateColumns.length > 0) {
        setParseError(
          t('csvUploader.errorDuplicateColumns', {
            columns: [...new Set(duplicateColumns)].join(', '),
          })
        );
        return null;
      }

      if (missingColumns.length > 0) {
        setParseError(
          t('csvUploader.errorMissingColumns', { columns: missingColumns.join(', ') })
        );
        return null;
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
            const message = t('csvUploader.errorMissingField', { field: col });
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
      return rows;
    },
    [requiredColumns, validators, strictHeaderValidation, t]
  );

  const handleFileParse = useCallback(
    (file: File) => {
      setParseError(null);

      if (!file.name.endsWith('.csv')) {
        setParseError(t('csvUploader.errorInvalidFormat'));
        notifyError(t('csvUploader.notifyInvalidFormatTitle'), t('csvUploader.notifyInvalidFormatBody'));
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
        setParseError(t('csvUploader.errorFileTooLarge', { maxSizeMB }));
        notifyError(t('csvUploader.notifyFileTooLargeTitle'), t('csvUploader.notifyFileTooLargeBody', { maxSizeMB }));
        return;
      }

      setFileName(file.name);
      setIsLoading(true);
      setParseProgress(0);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const rows = await parseCSV(content, (processed, total) => {
            setParseProgress(total > 0 ? Math.round((processed / total) * 100) : 100);
          });

          if (rows === null) {
            setIsLoading(false);
            return;
          }

          setParsedData(rows);
          onDataParsed(rows);
          setIsLoading(false);

          const validCount = rows.filter((r) => r.isValid).length;
          const invalidCount = rows.filter((r) => !r.isValid).length;

          if (validCount > 0) {
            const summary =
              invalidCount > 0
                ? `${t('csvUploader.validRowsPlural', { count: validCount })}, ${t('csvUploader.withErrorsPlural', { count: invalidCount })}`
                : t('csvUploader.rowsReadyPlural', { count: validCount });

            notifySuccess(t('csvUploader.notifyParsedSuccessTitle'), summary);
          }
        } catch (error) {
          setParseError(t('csvUploader.errorParsing'));
          console.error('CSV parsing error:', error);
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setParseError(t('csvUploader.errorReading'));
        setIsLoading(false);
      };

      reader.readAsText(file);
    },
    [parseCSV, onDataParsed, notifySuccess, notifyError]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileParse(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileParse(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const generateErrorReport = useCallback(() => {
    const errorRows = parsedData.filter((r) => !r.isValid);
    if (errorRows.length === 0) return;

    const columns = [t('csvUploader.columnRowNumber'), ...Object.keys(parsedData[0]?.data || {}), t('csvUploader.columnErrors')];
    const csvContent = [
      columns.map((col) => `"${col}"`).join(','),
      ...errorRows.map((row) => {
        const values = [
          row.rowNumber.toString(),
          ...Object.values(row.data).map((val) => `"${val}"`),
          `"${row.errors.join('; ')}"`,
        ];
        return values.join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `error-report-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [parsedData]);

  const validRowsCount = parsedData.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedData.filter((r) => !r.isValid).length;
  const hasData = parsedData.length > 0;

  const uploadZoneClasses = isDragging
    ? 'border-[var(--accent)] bg-[rgba(74,240,184,0.08)]'
    : 'border-[var(--border-hi)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hi)]';

  return (
    <div className="w-full" role="region" aria-label={t('csvUploader.regionAriaLabel')}>
      <div
        ref={uploadZoneRef}
        role="button"
        tabIndex={0}
        aria-label={t('csvUploader.uploadZoneAriaLabel')}
        aria-describedby={descriptionId}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleUploadZoneKeyDown}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${uploadZoneClasses} ${isLoading ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}
      >
        <input
          ref={fileInputRef}
          id="csv-file-input"
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <label htmlFor="csv-file-input" className="sr-only">
          {t('csvUploader.chooseFileLabel')}
        </label>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--text)]">{t('csvUploader.parsingFile')}</p>
            <div
              className="w-full max-w-xs"
              role="progressbar"
              aria-valuenow={parseProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('csvUploader.parsingFile')}
            >
              <div className="h-1.5 w-full rounded-full bg-[var(--surface-hi)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                  style={{ width: `${parseProgress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">{parseProgress}%</p>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                isDragging ? 'bg-[rgba(74,240,184,0.12)]' : 'bg-[var(--surface-hi)]'
              }`}
              aria-hidden="true"
            >
              {hasData ? (
                <FileSpreadsheet className="w-6 h-6 text-[var(--accent)]" />
              ) : (
                <Upload className="w-6 h-6 text-[var(--muted)]" />
              )}
            </div>
            <p className="text-base font-semibold text-[var(--text)]">
              {hasData ? t('csvUploader.dropNewFile') : t('csvUploader.dragAndDrop')}
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">
              {t('csvUploader.orPrefix')}{' '}
              <span className="text-[var(--accent)] font-medium underline underline-offset-2">
                {t('csvUploader.browseFiles')}
              </span>
            </p>
            <p className="text-xs text-[var(--muted)] mt-3" id={descriptionId}>
              {t('csvUploader.requiredColumnsPrefix')}{' '}
              <span className="font-mono text-[var(--text)]">{requiredColumns.join(', ')}</span>
            </p>
          </>
        )}
      </div>

      {parseError && (
        <div
          role="alert"
          aria-live="assertive"
          id={errorId}
          className="mt-4 flex items-start gap-3 rounded-xl border border-[rgba(255,123,114,0.28)] bg-[rgba(255,123,114,0.08)] p-4"
        >
          <XCircle className="w-5 h-5 shrink-0 text-[var(--danger)] mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[var(--danger)]">{t('csvUploader.uploadError')}</p>
            <p className="text-sm text-[var(--text)] mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {fileName && !parseError && (
        <div
          className="mt-4 rounded-xl border border-[var(--border-hi)] bg-[var(--surface)] p-4"
          aria-live="polite"
          aria-label={t('csvUploader.fileSummaryAriaLabel', { fileName })}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet
                className="w-4 h-4 text-[var(--accent)] shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-[var(--text)] truncate">{fileName}</p>
            </div>
            {invalidRowsCount > 0 && (
              <button
                onClick={generateErrorReport}
                className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--accent)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                title={t('csvUploader.downloadErrorReport')}
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                {t('csvUploader.exportErrors')}
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(63,185,80,0.1)] px-3 py-1 text-xs font-medium text-[var(--success)]">
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              {t('csvUploader.summaryValidOfTotal', {
                valid: validRowsCount,
                total: parsedData.length,
              })}
            </span>
            {invalidRowsCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,123,114,0.1)] px-3 py-1 text-xs font-medium text-[var(--danger)]">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {t('csvUploader.rowsWithErrorsCount', { count: invalidRowsCount })}
              </span>
            )}
          </div>
        </div>
      )}

      {invalidRowsCount > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-bold text-[var(--danger)] mb-4" id="row-errors-heading">
            {t('csvUploader.rowErrorsHeading', { count: invalidRowsCount })}
          </h3>
          <div
            className="overflow-x-auto rounded-xl border border-[rgba(255,123,114,0.28)] max-h-80 overflow-y-auto"
            role="table"
            aria-label={t('csvUploader.rowErrorsAriaLabel')}
            aria-describedby="row-errors-heading"
          >
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-hi)] bg-[rgba(255,123,114,0.06)] sticky top-0">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('csvUploader.columnRowNumber')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('csvUploader.columnField')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('csvUploader.columnErrorMessage')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {parsedData
                  .filter((row) => !row.isValid)
                  .flatMap((row) =>
                    row.fieldErrors.length > 0
                      ? row.fieldErrors.map((fieldError) => (
                          <tr
                            key={`${row.rowNumber}-${fieldError.field}-${fieldError.message}`}
                            className="bg-[rgba(255,123,114,0.04)]"
                          >
                            <td className="px-4 py-3 font-mono text-sm text-[var(--muted)]">
                              {row.rowNumber}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                              {fieldError.field}
                            </td>
                            <td className="px-4 py-3 text-sm text-[var(--danger)]">
                              {fieldError.message}
                            </td>
                          </tr>
                        ))
                      : [
                          <tr
                            key={`${row.rowNumber}-general`}
                            className="bg-[rgba(255,123,114,0.04)]"
                          >
                            <td className="px-4 py-3 font-mono text-sm text-[var(--muted)]">
                              {row.rowNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-[var(--muted)]">—</td>
                            <td className="px-4 py-3 text-sm text-[var(--danger)]">
                              {row.errors.join('; ')}
                            </td>
                          </tr>,
                        ]
                  )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasData && (
        <div className="mt-6">
          <h3 className="text-base font-bold text-[var(--text)] mb-4" id="preview-heading">
            {t('csvUploader.dataPreview')}
          </h3>
          <div
            className="overflow-x-auto rounded-xl border border-[var(--border-hi)]"
            role="table"
            aria-label={t('csvUploader.dataPreviewAriaLabel')}
            aria-describedby="preview-heading"
          >
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-hi)] bg-[var(--surface-hi)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('csvUploader.columnRow')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('csvUploader.columnStatus')}
                  </th>
                  {Object.keys(parsedData[0]?.data || {}).map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('csvUploader.columnErrors')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {parsedData.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`transition-colors ${
                      row.isValid
                        ? 'hover:bg-[var(--surface-hi)]'
                        : 'bg-[rgba(255,123,114,0.04)] hover:bg-[rgba(255,123,114,0.08)]'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-[var(--muted)]">
                      {row.rowNumber}
                    </td>
                    <td className="px-4 py-3">
                      {row.isValid ? (
                        <CheckCircle
                          className="w-5 h-5 text-[var(--success)]"
                          aria-label={t('csvUploader.validRow')}
                        />
                      ) : (
                        <AlertCircle
                          className="w-5 h-5 text-[var(--danger)]"
                          aria-label={t('csvUploader.rowHasErrors')}
                        />
                      )}
                    </td>

                    {Object.entries(row.data).map(([col, value]) => (
                      <td
                        key={`${row.rowNumber}-${col}`}
                        className="px-4 py-3 text-sm text-[var(--text)] truncate max-w-[200px]"
                        title={value}
                      >
                        {value || <span className="text-[var(--muted)] italic">{t('csvUploader.empty')}</span>}
                      </td>
                    ))}

                    <td className="px-4 py-3 text-xs">
                      {row.errors.length > 0 ? (
                        <ul className="space-y-1 list-none p-0 m-0">
                          {row.errors.map((error) => (
                            <li key={`${row.rowNumber}-${error}`} className="text-[var(--danger)]">
                              {error}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[var(--success)] font-medium">{t('csvUploader.ok')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};