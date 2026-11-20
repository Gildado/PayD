/**
 * Monthly Payroll Digest UI Component for Org Admins
 */

import React, { useState } from 'react';
import { fetchMonthlyPayrollDigest } from '../../services/advancedReportApi';

export interface MonthlyPayrollDigestCardProps {
  organizationId: number | string;
}

export interface MonthlyPayrollSummary {
  totalEmployeesPaid?: number;
  totalAmountTransacted?: string | number;
  overallSuccessRate?: number;
  failedTransactions?: number;
}

export interface AnomalyItem {
  employeeId?: string | number;
  reason: string;
  amount: string | number;
}

export interface MonthlyPayrollDigestReport {
  summary?: MonthlyPayrollSummary;
  anomaliesDetected?: AnomalyItem[];
}

export const MonthlyPayrollDigestCard: React.FC<MonthlyPayrollDigestCardProps> = ({ organizationId }) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<MonthlyPayrollDigestReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMonthlyPayrollDigest({ organizationId, month }) as { data?: MonthlyPayrollDigestReport[] } & MonthlyPayrollDigestReport;
      const parsed = result.data?.[0] ?? result;
      setReportData(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--surface)] text-[var(--text)] border border-[var(--border-hi)] shadow-[var(--shadow-card)] rounded-2xl p-6 max-w-4xl mx-auto my-4 transition-colors">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            Executive Summary
          </p>
          <h3 className="text-xl font-bold font-[var(--font-head)] tracking-tight text-[var(--text)] mt-0.5">
            Monthly Payroll Summary Digest
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="month"
            value={month}
            aria-label="Select digest month"
            onChange={(e) => setMonth(e.target.value)}
            className="border border-[var(--border-hi)] bg-[var(--surface-hi)] text-[var(--text)] rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent)_18%,transparent)] transition-all"
          />
          <button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            disabled={loading}
            className="bg-[var(--accent)] text-[var(--on-accent)] px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Digest'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[color:color-mix(in_srgb,var(--danger)_12%,transparent)] border-l-4 border-[var(--danger)] text-[var(--danger)] p-4 mb-6 rounded-r-xl text-sm font-medium">
          {error}
        </div>
      )}

      {reportData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--surface-hi)]/80 p-5 rounded-2xl border border-[var(--border)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Employees Paid</p>
              <p className="text-2xl font-black text-[var(--text)] mt-1 font-[var(--font-head)]">{reportData.summary?.totalEmployeesPaid ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Total Transacted</p>
              <p className="text-2xl font-black text-[var(--text)] mt-1 font-[var(--font-head)]">${reportData.summary?.totalAmountTransacted ?? '0.00'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Success Rate</p>
              <p className="text-2xl font-black text-[var(--text)] mt-1 font-[var(--font-head)]">{reportData.summary?.overallSuccessRate ?? 100}%</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Failed Transactions</p>
              <p className="text-2xl font-black text-[var(--danger)] mt-1 font-[var(--font-head)]">{reportData.summary?.failedTransactions ?? 0}</p>
            </div>
          </div>

          {reportData.anomaliesDetected && reportData.anomaliesDetected.length > 0 && (
            <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-xl">
              <h4 className="text-sm font-bold text-amber-500">Anomalies Detected</h4>
              <ul className="mt-2 text-sm text-[var(--text)]/85 list-disc list-inside space-y-1">
                {reportData.anomaliesDetected.map((anom, idx) => (
                  <li key={`${anom.employeeId ?? idx}-${anom.reason}`}>
                    {anom.employeeId ? `Employee ${anom.employeeId}: ` : ''}{anom.reason} ({anom.amount})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
