import React from 'react';
import { CSVUploader } from '../CSVUploader';
import type { CSVRow } from '../CSVUploader';
import type { Employee } from './types';

interface CSVImportPanelProps {
  csvData: Employee[];
  onDataParsed: (data: CSVRow[]) => void;
  onAddEmployees: () => void;
  onCancel: () => void;
}

export const CSVImportPanel: React.FC<CSVImportPanelProps> = ({
  csvData,
  onDataParsed,
  onAddEmployees,
  onCancel,
}) => (
  <div className="border-b border-hi bg-[color:rgba(255,255,255,0.02)] px-5 py-6 sm:px-6">
    <div className="rounded-[24px] border border-[var(--border-hi)] bg-[var(--surface)] p-5 sm:p-6">
      <CSVUploader
        requiredColumns={['name', 'email', 'wallet', 'position', 'salary', 'status']}
        onDataParsed={onDataParsed}
      />
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-hi px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--border-hi)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAddEmployees}
          disabled={csvData.length === 0}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--bg)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add {csvData.length || 0} employee{csvData.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  </div>
);
