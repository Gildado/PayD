import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { CSVTranslate } from '../utils/csvParser';

export interface ColumnMappingPanelProps {
  show: boolean;
  uploadedHeaders: string[];
  columnMapping: Record<string, string>;
  requiredColumns: string[];
  prefersReducedMotion: boolean;
  transitionDuration: number;
  t: CSVTranslate;
  onMappingChange: (header: string, value: string) => void;
  onCancel: () => void;
  onComplete: () => void;
}

export const ColumnMappingPanel: React.FC<ColumnMappingPanelProps> = ({
  show,
  uploadedHeaders,
  columnMapping,
  requiredColumns,
  prefersReducedMotion,
  transitionDuration,
  t,
  onMappingChange,
  onCancel,
  onComplete,
}) => {
  return (
    <AnimatePresence>
      {show && uploadedHeaders.length > 0 && (
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
                  onChange={(e) => onMappingChange(header, e.target.value)}
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
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hi)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-hi)]"
            >
              {t('csvUploader.cancel')}
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--on-accent)] transition-colors hover:brightness-110"
            >
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              {t('csvUploader.continueWithMapping', 'Continue')}
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
