import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle } from 'lucide-react';
import type { CSVRow, CSVRowFilter, CSVTranslate } from '../utils/csvParser';

const TH_CLASS =
  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)] whitespace-nowrap';

export interface RowErrorsTableProps {
  show: boolean;
  parsedData: CSVRow[];
  invalidRowsCount: number;
  rowErrorsHeadingId: string;
  prefersReducedMotion: boolean;
  transitionDuration: number;
  t: CSVTranslate;
}

export const RowErrorsTable: React.FC<RowErrorsTableProps> = ({
  show,
  parsedData,
  invalidRowsCount,
  rowErrorsHeadingId,
  prefersReducedMotion,
  transitionDuration,
  t,
}) => {
  return (
    <AnimatePresence>
      {show && (
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
  );
};

export interface PreviewTableProps {
  show: boolean;
  visibleRows: CSVRow[];
  previewColumns: string[];
  rowFilter: CSVRowFilter;
  filterOptions: Array<{ value: CSVRowFilter; label: string }>;
  previewHeadingId: string;
  prefersReducedMotion: boolean;
  transitionDuration: number;
  t: CSVTranslate;
  onRowFilterChange: (filter: CSVRowFilter) => void;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  show,
  visibleRows,
  previewColumns,
  rowFilter,
  filterOptions,
  previewHeadingId,
  prefersReducedMotion,
  transitionDuration,
  t,
  onRowFilterChange,
}) => {
  return (
    <>
      {show && (
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
                  onClick={() => onRowFilterChange(option.value)}
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
    </>
  );
};
