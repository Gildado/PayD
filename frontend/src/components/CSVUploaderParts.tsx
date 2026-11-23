import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { CSVTranslate } from '../utils/csvParser';
import { formatFileSize } from '../utils/csvParser';

export interface UploadZoneProps {
  uploadZoneRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  descriptionId: string;
  requiredColumns: string[];
  hasData: boolean;
  isDragging: boolean;
  isLoading: boolean;
  enableTemplateDownload: boolean;
  prefersReducedMotion: boolean;
  transitionDuration: number;
  maxSizeMB: string;
  t: CSVTranslate;
  onZoneClick: (e: React.MouseEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: (e: React.MouseEvent) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  uploadZoneRef,
  fileInputRef,
  descriptionId,
  requiredColumns,
  hasData,
  isDragging,
  isLoading,
  enableTemplateDownload,
  prefersReducedMotion,
  transitionDuration,
  maxSizeMB,
  t,
  onZoneClick,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onKeyDown,
  onFileSelect,
  onDownloadTemplate,
}) => {
  const uploadZoneClasses = isDragging ? 'dnd-zone-active' : 'dnd-zone-idle';

  return (
    <motion.div
      ref={uploadZoneRef}
      role="button"
      tabIndex={0}
      aria-label={t('csvUploader.uploadZoneAriaLabel')}
      aria-describedby={descriptionId}
      aria-disabled={isLoading || undefined}
      onClick={onZoneClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      animate={{ scale: !prefersReducedMotion && isDragging ? 1.01 : 1 }}
      transition={{ duration: transitionDuration, ease: [0.4, 0, 0.2, 1] }}
      className={`dnd-zone relative rounded-2xl border-2 border-dashed px-5 py-10 text-center sm:px-10 sm:py-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${uploadZoneClasses} ${isLoading ? 'cursor-progress opacity-60' : 'cursor-pointer'}`}
    >
      <input
        ref={fileInputRef}
        id={`${descriptionId}-input`}
        type="file"
        accept=".csv,text/csv"
        onChange={onFileSelect}
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
            onClick={onDownloadTemplate}
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
  );
};

export interface ErrorAlertProps {
  show: boolean;
  errorId: string;
  parseError: string | null;
  prefersReducedMotion: boolean;
  transitionDuration: number;
  t: CSVTranslate;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  show,
  errorId,
  parseError,
  prefersReducedMotion,
  transitionDuration,
  t,
}) => {
  const fadeIn = {
    initial: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: prefersReducedMotion ? 1 : 0 },
    transition: { duration: transitionDuration },
  };

  return (
    <AnimatePresence>
      {show && (
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
  );
};

export interface FileSummaryProps {
  show: boolean;
  fileName: string | null;
  fileSize: number;
  isLoading: boolean;
  invalidRowsCount: number;
  hasData: boolean;
  parsedDataLength: number;
  validRowsCount: number;
  parseProgress: number;
  phaseLabel: string;
  phase: 'reading' | 'validating' | 'mapping';
  progressLabelId: string;
  prefersReducedMotion: boolean;
  transitionDuration: number;
  t: CSVTranslate;
  onGenerateErrorReport: () => void;
  onOpenFilePicker: () => void;
  onRemoveFile: () => void;
}

export const FileSummary: React.FC<FileSummaryProps> = ({
  show,
  fileName,
  fileSize,
  isLoading,
  invalidRowsCount,
  hasData,
  parsedDataLength,
  validRowsCount,
  parseProgress,
  phaseLabel,
  phase,
  progressLabelId,
  prefersReducedMotion,
  transitionDuration,
  t,
  onGenerateErrorReport,
  onOpenFilePicker,
  onRemoveFile,
}) => {
  const fadeIn = {
    initial: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: prefersReducedMotion ? 1 : 0 },
    transition: { duration: transitionDuration },
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="mt-4 rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5"
          aria-live="polite"
          aria-label={t('csvUploader.fileSummaryAriaLabel', { fileName: fileName || '' })}
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
                    onClick={onGenerateErrorReport}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--on-accent)] transition-[filter] duration-200 hover:brightness-110 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                    title={t('csvUploader.downloadErrorReport')}
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('csvUploader.exportErrors')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenFilePicker}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hi)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('csvUploader.replaceFile')}
                </button>
                <button
                  type="button"
                  onClick={onRemoveFile}
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
                    total: parsedDataLength,
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
  );
};
