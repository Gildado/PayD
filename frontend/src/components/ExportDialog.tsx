import React, { useEffect, useState } from 'react';
import { Calendar, CheckSquare, Download, FileSpreadsheet, FileText, Square, X } from 'lucide-react';
import {
  PAYROLL_EXPORT_COLUMNS,
  loadExportDefaults,
  saveExportDefaults,
  type PayrollExportColumn,
  type PayrollExportColumnId,
  type PayrollExportFormat,
} from '../services/customReportExport';

export interface ExportDialogSubmitParams {
  format: PayrollExportFormat;
  columns: PayrollExportColumnId[];
  startDate: string;
  endDate: string;
  reportName: string;
}

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (params: ExportDialogSubmitParams) => Promise<void> | void;
  title?: string;
  availableColumns?: PayrollExportColumn[];
  initialReportName?: string;
  isExporting?: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  title = 'Export Payroll History',
  availableColumns = PAYROLL_EXPORT_COLUMNS,
  initialReportName = 'payroll-history',
  isExporting = false,
}) => {
  const [format, setFormat] = useState<PayrollExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<PayrollExportColumnId[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportName, setReportName] = useState(initialReportName);
  const [rememberDefaults, setRememberDefaults] = useState(true);
  const [columnError, setColumnError] = useState<string | null>(null);

  // Initialize or re-initialize from remembered defaults on open
  useEffect(() => {
    if (isOpen) {
      const defaults = loadExportDefaults();
      setFormat(defaults.format || 'csv');
      setSelectedColumns(
        defaults.columns && defaults.columns.length > 0
          ? defaults.columns
          : availableColumns.map((col) => col.id)
      );
      setStartDate(defaults.startDate || '');
      setEndDate(defaults.endDate || '');
      setReportName(initialReportName);
      setColumnError(null);
    }
  }, [isOpen, availableColumns, initialReportName]);

  if (!isOpen) return null;

  const handleToggleColumn = (id: PayrollExportColumnId) => {
    setSelectedColumns((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((col) => col !== id) : [...prev, id];
      if (next.length > 0) setColumnError(null);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedColumns(availableColumns.map((col) => col.id));
    setColumnError(null);
  };

  const handleDeselectAll = () => {
    setSelectedColumns([]);
    setColumnError('Select at least one column to export.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedColumns.length === 0) {
      setColumnError('Select at least one column to export.');
      return;
    }

    if (rememberDefaults) {
      saveExportDefaults({
        format,
        columns: selectedColumns,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    }

    void onExport({
      format,
      columns: selectedColumns,
      startDate,
      endDate,
      reportName: reportName.trim() || 'payroll-history',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="relative w-full max-w-2xl bg-[var(--surface,#ffffff)] dark:bg-[var(--surface-dark,#1a1d24)] rounded-2xl shadow-2xl border border-[var(--border,#e2e8f0)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border,#e2e8f0)]">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-[var(--accent,#4f46e5)]" aria-hidden="true" />
            <h2 id="export-dialog-title" className="text-lg font-bold text-[var(--text,#0f172a)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Format selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted,#64748b)]">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'csv', label: 'CSV', icon: FileSpreadsheet, desc: 'Spreadsheet format' },
                { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Printable report' },
                { id: 'excel', label: 'Excel', icon: FileSpreadsheet, desc: '.xlsx workbook' },
              ].map(({ id, label, icon: Icon, desc }) => {
                const isSelected = format === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormat(id as PayrollExportFormat)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'border-[var(--accent,#4f46e5)] bg-[var(--accent,#4f46e5)]/10 text-[var(--accent,#4f46e5)] font-semibold'
                        : 'border-[var(--border,#e2e8f0)] hover:border-gray-400 text-gray-600 dark:text-gray-300'
                    }`}
                    data-testid={`format-option-${id}`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-sm">{label}</span>
                    <span className="text-[10px] text-[var(--muted,#64748b)]">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range pickers */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--muted,#64748b)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Date Range (Optional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="export-start-date"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Start Date
                </label>
                <input
                  id="export-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border,#e2e8f0)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent,#4f46e5)]"
                />
              </div>
              <div>
                <label
                  htmlFor="export-end-date"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  End Date
                </label>
                <input
                  id="export-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border,#e2e8f0)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent,#4f46e5)]"
                />
              </div>
            </div>
          </div>

          {/* Report Name */}
          <div className="space-y-1">
            <label
              htmlFor="export-report-name"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              Report Name / File Prefix
            </label>
            <input
              id="export-report-name"
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="payroll-export"
              className="w-full px-3 py-2 border border-[var(--border,#e2e8f0)] rounded-lg text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent,#4f46e5)]"
            />
          </div>

          {/* Column selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted,#64748b)]">
                  Choose Columns
                </span>
                <span className="ml-2 text-xs text-[var(--muted,#64748b)]">
                  ({selectedColumns.length} of {availableColumns.length} selected)
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent,#4f46e5)] hover:underline font-medium"
                >
                  <CheckSquare className="w-3 h-3" />
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline font-medium"
                >
                  <Square className="w-3 h-3" />
                  Deselect all
                </button>
              </div>
            </div>

            {columnError ? (
              <p role="alert" className="text-xs font-semibold text-rose-500">
                {columnError}
              </p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-[var(--border,#e2e8f0)] rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
              {availableColumns.map((column) => {
                const checked = selectedColumns.includes(column.id);
                return (
                  <label
                    key={column.id}
                    className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer text-xs select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleColumn(column.id)}
                      className="mt-0.5 rounded text-[var(--accent,#4f46e5)] focus:ring-[var(--accent,#4f46e5)]"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {column.label}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{column.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Remember defaults checkbox */}
          <div className="pt-2 border-t border-[var(--border,#e2e8f0)]">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberDefaults}
                onChange={(e) => setRememberDefaults(e.target.checked)}
                className="rounded text-[var(--accent,#4f46e5)] focus:ring-[var(--accent,#4f46e5)]"
              />
              <span>Remember these choices as defaults for next time</span>
            </label>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExporting || selectedColumns.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent,#4f46e5)] hover:bg-[var(--accent,#4f46e5)]/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
              data-testid="confirm-export-button"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

ExportDialog.displayName = 'ExportDialog';
