import React, { useState, useRef, useCallback, useId, useMemo, useEffect } from 'react';
import {
  Upload,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';
import { generateCSVTemplate, downloadCSV, createAutoMapping, mapRowData } from '../utils/csvTemplateGenerator';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
// Rows are validated in chunks with a yield to the event loop in between, so
// large files (up to MAX_FILE_SIZE) don't block the UI thread while parsing.
const CHUNK_SIZE = 500;
// Share of the progress bar given to reading the file; validation fills the rest.
const READ_PHASE_WEIGHT = 30;

type UploadPhase = 'reading' | 'validating' | 'mapping';
type RowFilter = 'all' | 'valid' | 'invalid';

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
  enableColumnMapping?: boolean;
  enableTemplateDownload?: boolean;
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

/** Quote a value for the exported error report (RFC 4180). */
function toCSVField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TH_CLASS =
  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)] whitespace-nowrap';

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  requiredColumns,
  onDataParsed,
  validators = {},
  strictHeaderValidation = true,
  enableColumnMapping = false,
  enableTemplateDownload = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('reading');
  const [parseProgress, setParseProgress] = useState<number>(0);
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingUI, setShowMappingUI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const dragDepth = useRef(0);
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useNotification();
  const errorId = useId();
  const descriptionId = useId();
  const progressLabelId = useId();
  const rowErrorsHeadingId = useId();
  const previewHeadingId = useId();
  const prefersReducedMotion = useReducedMotion();
  const transitionDuration = prefersReducedMotion ? 0 : 0.2;

  useEffect(() => {
    if (enableColumnMapping && typeof Worker !== 'undefined') {
      const worker = new Worker(
        new URL('../workers/csvParser.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      return () => {
        worker.terminate();
      };
    }
  }, [enableColumnMapping]);

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
        setParseError(t('csvUploader.errorMissingColumns', { columns: missingColumns.join(', ') }));
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

      if (!file.name.toLowerCase().endsWith('.csv')) {
        setParseError(t('csvUploader.errorInvalidFormat'));
        notifyError(
          t('csvUploader.notifyInvalidFormatTitle'),
          t('csvUploader.notifyInvalidFormatBody')
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
        setParseError(t('csvUploader.errorFileTooLarge', { maxSizeMB }));
        notifyError(
          t('csvUploader.notifyFileTooLargeTitle'),
          t('csvUploader.notifyFileTooLargeBody', { maxSizeMB })
        );
        return;
      }

      setFileName(file.name);
      setFileSize(file.size);
      setParsedData([]);
      setRowFilter('all');
      setUploadedHeaders([]);
      setShowMappingUI(false);
      setIsLoading(true);
      setPhase('reading');
      setParseProgress(0);
      const reader = new FileReader();

      reader.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          setParseProgress(Math.round((e.loaded / e.total) * READ_PHASE_WEIGHT));
        }
      };

      reader.onload = async (e) => {
        try {
          setPhase('validating');
          setParseProgress(READ_PHASE_WEIGHT);
          const content = e.target?.result as string;
          const rows = await parseCSV(content, (processed, total) => {
            const validated = total > 0 ? processed / total : 1;
            setParseProgress(Math.round(READ_PHASE_WEIGHT + validated * (100 - READ_PHASE_WEIGHT)));
          });

          if (rows === null) {
            setIsLoading(false);
            return;
          }

          setParsedData(rows);

          if (enableColumnMapping && rows.length > 0) {
            const headers = Object.keys(rows[0].data);
            setUploadedHeaders(headers);
            const autoMapping = createAutoMapping(headers, requiredColumns);
            setColumnMapping(autoMapping);
            setShowMappingUI(true);
            setIsLoading(false);
            return;
          }

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
    [parseCSV, onDataParsed, notifySuccess, notifyError, t, enableColumnMapping, requiredColumns]
  );

  const openFilePicker = () => {
    if (!isLoading) fileInputRef.current?.click();
  };

  const handleUploadZoneClick = (e: React.MouseEvent) => {
    // The hidden input lives inside the zone, so its own click bubbles here.
    if (e.target === fileInputRef.current) return;
    openFilePicker();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && !isLoading) {
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
      openFilePicker();
    }
  };

  const handleRemoveFile = () => {
    setParsedData([]);
    setFileName(null);
    setFileSize(0);
    setParseError(null);
    setRowFilter('all');
    onDataParsed([]);
    uploadZoneRef.current?.focus();
  };

  const generateErrorReport = useCallback(() => {
    const errorRows = parsedData.filter((r) => !r.isValid);
    if (errorRows.length === 0) return;

    const columns = [
      t('csvUploader.columnRowNumber'),
      ...Object.keys(parsedData[0]?.data || {}),
      t('csvUploader.columnErrors'),
    ];
    const csvContent = [
      columns.map(toCSVField).join(','),
      ...errorRows.map((row) =>
        [
          row.rowNumber.toString(),
          ...Object.values(row.data).map(toCSVField),
          toCSVField(row.errors.join('; ')),
        ].join(',')
      ),
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
  }, [parsedData, t]);

  const handleDownloadTemplate = useCallback(() => {
    const template = generateCSVTemplate({
      columns: requiredColumns,
      sampleData: [requiredColumns.reduce((row, col) => ({ ...row, [col]: '' }), {})],
    });
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(template, `import-template-${timestamp}.csv`);
    notifySuccess(
      t('csvUploader.templateDownloaded', 'Template downloaded'),
      t('csvUploader.templateDownloadedBody', 'CSV template ready for import')
    );
  }, [requiredColumns, notifySuccess, t]);

  const handleMappingComplete = useCallback(() => {
    if (showMappingUI && uploadedHeaders.length > 0) {
      setShowMappingUI(false);
      setPhase('validating');
      setParseProgress(READ_PHASE_WEIGHT);

      const mappedData = parsedData.map((row) => {
        const mappedRowData = mapRowData(row.data, columnMapping);
        return {
          ...row,
          data: mappedRowData,
        };
      });

      setParsedData(mappedData);
      onDataParsed(mappedData);

      const validCount = mappedData.filter((r) => r.isValid).length;
      const invalidCount = mappedData.filter((r) => !r.isValid).length;

      if (validCount > 0) {
        const summary =
          invalidCount > 0
            ? `${t('csvUploader.validRowsPlural', { count: validCount })}, ${t('csvUploader.withErrorsPlural', { count: invalidCount })}`
            : t('csvUploader.rowsReadyPlural', { count: validCount });

        notifySuccess(t('csvUploader.notifyParsedSuccessTitle'), summary);
      }
    }
  }, [showMappingUI, uploadedHeaders, columnMapping, parsedData, onDataParsed, t, notifySuccess]);

  const validRowsCount = parsedData.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedData.length - validRowsCount;
  const hasData = parsedData.length > 0;
  const previewColumns = Object.keys(parsedData[0]?.data || {});
  const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);

  const visibleRows = useMemo(() => {
    if (rowFilter === 'valid') return parsedData.filter((r) => r.isValid);
    if (rowFilter === 'invalid') return parsedData.filter((r) => !r.isValid);
    return parsedData;
  }, [parsedData, rowFilter]);

  const phaseLabel =
    phase === 'reading' ? t('csvUploader.phaseReading') : t('csvUploader.phaseValidating');

  const filterOptions: Array<{ value: RowFilter; label: string }> = [
    { value: 'all', label: t('csvUploader.filterAll', { count: parsedData.length }) },
    { value: 'valid', label: t('csvUploader.filterValid', { count: validRowsCount }) },
    { value: 'invalid', label: t('csvUploader.filterInvalid', { count: invalidRowsCount }) },
  ];

  const uploadZoneClasses = isDragging ? 'dnd-zone-active' : 'dnd-zone-idle';
  const fadeIn = {
    initial: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: prefersReducedMotion ? 1 : 0 },
    transition: { duration: transitionDuration },
  };

  return (
    <div className="w-full min-w-0" role="region" aria-label={t('csvUploader.regionAriaLabel')}>
      <motion.div
        ref={uploadZoneRef}
        role="button"
        tabIndex={0}
        aria-label={t('csvUploader.uploadZoneAriaLabel')}
        aria-describedby={descriptionId}
        aria-disabled={isLoading || undefined}
        onClick={handleUploadZoneClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleUploadZoneKeyDown}
        animate={{ scale: !prefersReducedMotion && isDragging ? 1.01 : 1 }}
        transition={{ duration: transitionDuration, ease: [0.4, 0, 0.2, 1] }}
        className={`dnd-zone relative rounded-2xl border-2 border-dashed px-5 py-10 text-center sm:px-10 sm:py-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${uploadZoneClasses} ${isLoading ? 'cursor-progress opacity-60' : 'cursor-pointer'}`}
      >
        <input
          ref={fileInputRef}
          id={`${descriptionId}-input`}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileSelect}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <label htmlFor={`${descriptionId}-input`} className="sr-only">
          {t('csvUploader.chooseFileLabel')}
        </label>

        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-200 motion-reduce:transition-none ${
            isDragging
              ? 'bg-[var(--accent)] text-[var(--on-accent)] dnd-icon-bounce'
              : 'bg-[var(--accent)]/10 text-[var(--accent)]'
          }`}
          aria-hidden="true"
        >
          {hasData && !isDragging ? (
            <FileSpreadsheet className="h-7 w-7" />
          ) : (
            <Upload className="h-7 w-7" />
          )}
        </div>
        <p
          className="text-base font-bold text-[var(--text)] sm:text-lg"
          style={{ fontFamily: 'var(--font-head)' }}
        >
          {isDragging
            ? t('csvUploader.dropHere')
            : hasData
              ? t('csvUploader.dropNewFile')
              : t('csvUploader.dragAndDrop')}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t('csvUploader.orPrefix')}{' '}
          <span className="font-semibold text-[var(--accent)] underline underline-offset-4">
            {t('csvUploader.browseFiles')}
          </span>
        </p>
        {enableTemplateDownload && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadTemplate();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hi)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              title={t('csvUploader.downloadTemplate')}
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              {t('csvUploader.downloadTemplate', 'Download Template')}
            </button>
          </div>
        )}
        <div className="mt-5 flex flex-col items-center gap-1 text-xs text-[var(--muted)]">
          <p id={descriptionId}>
            {t('csvUploader.requiredColumnsPrefix')}{' '}
            <span className="font-mono text-[var(--text)] break-words">
              {requiredColumns.join(', ')}
            </span>
          </p>
          <p>{t('csvUploader.fileLimitHint', { maxSizeMB })}</p>
        </div>
      </motion.div>

      <AnimatePresence>
        {parseError && (
          <motion.div
            role="alert"
            aria-live="assertive"
            id={errorId}
            {...fadeIn}
            className="mt-4 flex items-start gap-3 rounded-2xl border border-danger/[0.28] bg-danger/[0.08] p-4"
          >
            <XCircle className="w-5 h-5 shrink-0 text-[var(--danger)] mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-[var(--danger)]">
                {t('csvUploader.uploadError')}
              </p>
              <p className="text-sm text-[var(--text)] mt-0.5">{parseError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fileName && !parseError && (
          <motion.div
            className="mt-4 rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5"
            aria-live="polite"
            aria-label={t('csvUploader.fileSummaryAriaLabel', { fileName })}
            {...fadeIn}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]"
                  aria-hidden="true"
                >
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{fileName}</p>
                  <p className="text-xs text-[var(--muted)]">{formatFileSize(fileSize)}</p>
                </div>
              </div>
              {!isLoading && (
                <div className="flex flex-wrap items-center gap-2">
                  {invalidRowsCount > 0 && (
                    <button
                      type="button"
                      onClick={generateErrorReport}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--on-accent)] transition-[filter] duration-200 hover:brightness-110 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                      title={t('csvUploader.downloadErrorReport')}
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('csvUploader.exportErrors')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hi)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('csvUploader.replaceFile')}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    aria-label={t('csvUploader.removeFile')}
                    title={t('csvUploader.removeFile')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-danger/10 hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span id={progressLabelId} className="font-semibold text-[var(--text)]">
                    {t('csvUploader.phaseStep', {
                      step: phase === 'reading' ? 1 : 2,
                      total: 2,
                      phase: phaseLabel,
                    })}
                  </span>
                  <span className="font-mono text-[var(--muted)]">{parseProgress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-labelledby={progressLabelId}
                  aria-valuenow={parseProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`${phaseLabel}: ${parseProgress}%`}
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hi)]"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] transition-[width] duration-150 motion-reduce:transition-none"
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              hasData && (
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-[var(--success)]">
                    <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('csvUploader.summaryValidOfTotal', {
                      valid: validRowsCount,
                      total: parsedData.length,
                    })}
                  </span>
                  {invalidRowsCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-[var(--danger)]">
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('csvUploader.rowsWithErrorsCount', { count: invalidRowsCount })}
                    </span>
                  )}
                </div>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMappingUI && uploadedHeaders.length > 0 && (
          <motion.section
            className="mt-6"
            initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: prefersReducedMotion ? 1 : 0 }}
            transition={{ duration: transitionDuration }}
          >
            <h3 className="mb-4 text-base font-bold text-[var(--text)]">
              {t('csvUploader.mapColumnsHeading', 'Map Your Columns')}
            </h3>
            <p className="mb-4 text-sm text-[var(--muted)]">
              {t('csvUploader.mapColumnsDescription', 'Match your file columns to the required fields')}
            </p>

            <div className="rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)] p-5 space-y-4">
              {uploadedHeaders.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-2">
                      {header}
                    </label>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[var(--muted)]" aria-hidden="true" />
                  <select
                    value={columnMapping[header] || ''}
                    onChange={(e) => {
                      setColumnMapping((prev) => ({
                        ...prev,
                        [header]: e.target.value,
                      }));
                    }}
                    className="flex-1 rounded-xl border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3 py-2 text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    <option value="">{t('csvUploader.selectColumn', 'Select a column')}</option>
                    {requiredColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowMappingUI(false);
                  handleRemoveFile();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hi)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hi)]"
              >
                {t('csvUploader.cancel')}
              </button>
              <button
                type="button"
                onClick={handleMappingComplete}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--on-accent)] transition-colors hover:brightness-110"
              >
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                {t('csvUploader.continueWithMapping', 'Continue')}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {invalidRowsCount > 0 && (
          <motion.section
            className="mt-6"
            aria-labelledby={rowErrorsHeadingId}
            initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: prefersReducedMotion ? 1 : 0 }}
            transition={{ duration: transitionDuration }}
          >
            <h3 className="mb-3 text-base font-bold text-[var(--danger)]" id={rowErrorsHeadingId}>
              {t('csvUploader.rowErrorsHeading', { count: invalidRowsCount })}
            </h3>
            <div
              className="relative max-h-80 overflow-auto rounded-2xl border border-danger/[0.28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              tabIndex={0}
              role="region"
              aria-labelledby={rowErrorsHeadingId}
            >
              <table
                className="min-w-full border-collapse text-left"
                aria-label={t('csvUploader.rowErrorsAriaLabel')}
              >
                <thead>
                  <tr className="sticky top-0 border-b border-[var(--border-hi)] bg-[var(--surface-hi)]">
                    <th scope="col" className={TH_CLASS}>
                      {t('csvUploader.columnRowNumber')}
                    </th>
                    <th scope="col" className={TH_CLASS}>
                      {t('csvUploader.columnField')}
                    </th>
                    <th scope="col" className={TH_CLASS}>
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
                              className="bg-danger/[0.04]"
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
                            <tr key={`${row.rowNumber}-general`} className="bg-danger/[0.04]">
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
          </motion.section>
        )}
      </AnimatePresence>

      {hasData && (
        <motion.section
          className="mt-6"
          aria-labelledby={previewHeadingId}
          initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: transitionDuration }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[var(--text)]" id={previewHeadingId}>
              {t('csvUploader.dataPreview')}
            </h3>
            <div
              role="group"
              aria-label={t('csvUploader.filterLabel')}
              className="inline-flex flex-wrap gap-1 rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] p-1"
            >
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={rowFilter === option.value}
                  onClick={() => setRowFilter(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    rowFilter === option.value
                      ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div
            className="relative overflow-x-auto rounded-2xl border border-[var(--border-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            tabIndex={0}
            role="region"
            aria-labelledby={previewHeadingId}
          >
            <table
              className="min-w-full border-collapse text-left"
              aria-label={t('csvUploader.dataPreviewAriaLabel')}
            >
              <thead>
                <tr className="border-b border-[var(--border-hi)] bg-[var(--surface-hi)]">
                  <th scope="col" className={TH_CLASS}>
                    {t('csvUploader.columnRow')}
                  </th>
                  <th scope="col" className={TH_CLASS}>
                    {t('csvUploader.columnStatus')}
                  </th>
                  {previewColumns.map((col) => (
                    <th key={col} scope="col" className={TH_CLASS}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={previewColumns.length + 2}
                      className="px-4 py-8 text-center text-sm text-[var(--muted)]"
                    >
                      {t('csvUploader.noRowsInFilter')}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`align-top transition-colors duration-150 motion-reduce:transition-none ${
                        row.isValid
                          ? 'hover:bg-[var(--surface-hi)]'
                          : 'bg-danger/[0.03] hover:bg-danger/[0.06]'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm text-[var(--muted)]">
                        {row.rowNumber}
                      </td>
                      <td className="px-4 py-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]">
                            <CheckCircle className="h-4 w-4" aria-hidden="true" />
                            {t('csvUploader.ok')}
                            <span className="sr-only">{t('csvUploader.validRow')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[var(--danger)]">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            {t('csvUploader.issuesCount', { count: row.errors.length })}
                            <span className="sr-only">{t('csvUploader.rowHasErrors')}</span>
                          </span>
                        )}
                      </td>

                      {Object.entries(row.data).map(([col, value]) => {
                        const cellErrors = row.fieldErrors.filter(
                          (fe) => fe.field.toLowerCase() === col
                        );
                        const hasCellError = cellErrors.length > 0;
                        return (
                          <td
                            key={`${row.rowNumber}-${col}`}
                            className={`max-w-[220px] px-4 py-3 text-sm ${
                              hasCellError
                                ? 'bg-danger/[0.06] shadow-[inset_0_-2px_0_var(--danger)]'
                                : ''
                            }`}
                          >
                            <span
                              className={`block truncate ${hasCellError ? 'text-[var(--danger)] font-medium' : 'text-[var(--text)]'}`}
                              title={value}
                            >
                              {value || (
                                <span className="italic text-[var(--muted)]">
                                  {t('csvUploader.empty')}
                                </span>
                              )}
                            </span>
                            {cellErrors.map((fe) => (
                              <span
                                key={fe.message}
                                className="mt-1 flex items-start gap-1 text-xs leading-snug text-[var(--danger)]"
                              >
                                <AlertCircle
                                  className="mt-0.5 h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <span>
                                  <span className="sr-only">
                                    {t('csvUploader.cellErrorPrefix')}{' '}
                                  </span>
                                  {fe.message}
                                </span>
                              </span>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </div>
  );
};
