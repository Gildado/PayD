/**
 * UI component for org admins to view the Jurisdiction Compliance Report.
 */

import React, { useEffect, useState } from 'react';
import { fetchJurisdictionComplianceReport } from '../../services/jurisdictionComplianceService';

interface Props {
  organizationId: number;
}

interface JurisdictionData {
  jurisdiction: string;
  totalWithheld: number;
  totalRemitted: number;
  pendingRemittance: number;
  complianceStatus: string;
}

interface RecommendationItem {
  type: string;
  jurisdiction: string;
  message: string;
}

interface ReportData {
  summary?: {
    totalEmployees?: number;
    totalWithheld?: number;
    totalRemitted?: number;
    totalPending?: number;
  };
  jurisdictions?: JurisdictionData[];
  recommendations?: RecommendationItem[];
}

export const JurisdictionComplianceReportView: React.FC<Props> = ({ organizationId }) => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (fetchJurisdictionComplianceReport(organizationId) as Promise<{ data?: ReportData[] }>)
      .then((res) => {
        setReportData(res.data?.[0] ?? null);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [organizationId]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-[var(--muted)] animate-pulse">
        Loading jurisdiction compliance report...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[var(--danger)] text-sm">
        Error: {error}
      </div>
    );
  }
  if (!reportData) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">
        No report data available.
      </div>
    );
  }

  return (
    <div className="jurisdiction-compliance-report rounded-2xl border border-[var(--border-hi)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] text-[var(--text)]">
      <h2 className="text-xl font-bold font-[var(--font-head)] tracking-tight text-[var(--text)] mb-6">
        Jurisdiction Compliance Report
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hi)] p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Total Tax Withheld</h4>
          <p className="text-2xl font-black text-[var(--text)] font-[var(--font-head)] mt-1">
            ${reportData.summary?.totalWithheld ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hi)] p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Pending Remittance</h4>
          <p className="text-2xl font-black text-[var(--danger)] font-[var(--font-head)] mt-1">
            ${reportData.summary?.totalPending ?? 0}
          </p>
        </div>
      </div>

      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
        Jurisdictions
      </h3>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] mb-6">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-hi)] text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              <th scope="col" className="p-3">Jurisdiction</th>
              <th scope="col" className="p-3">Withheld</th>
              <th scope="col" className="p-3">Remitted</th>
              <th scope="col" className="p-3">Pending</th>
              <th scope="col" className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {reportData.jurisdictions?.map((j: JurisdictionData) => (
              <tr key={j.jurisdiction} className="hover:bg-[var(--surface-hi)]/50 transition-colors">
                <td className="p-3 font-semibold text-[var(--text)]">{j.jurisdiction}</td>
                <td className="p-3 text-[var(--text)]">${j.totalWithheld}</td>
                <td className="p-3 text-[var(--text)]">${j.totalRemitted}</td>
                <td className="p-3 text-[var(--danger)] font-medium">${j.pendingRemittance}</td>
                <td className="p-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    j.complianceStatus === 'Compliant'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}>
                    {j.complianceStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reportData.recommendations && reportData.recommendations.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hi)]/60 p-4">
          <h3 className="text-sm font-bold text-[var(--text)] mb-2">Recommendations & Action Items</h3>
          <ul className="space-y-1.5 text-sm">
            {reportData.recommendations.map((rec: RecommendationItem) => (
              <li
                key={`${rec.jurisdiction}-${rec.type}-${rec.message}`}
                className={rec.type === 'action' ? 'text-[var(--danger)] font-medium' : 'text-amber-400'}
              >
                <strong className="text-[var(--text)]">[{rec.jurisdiction}]</strong> {rec.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
