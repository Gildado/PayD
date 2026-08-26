import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DashboardSnapshot, InsightReport } from '../types/insightCards';
import { generateInsightReport, worstSeverity } from '../services/insightCardAgent';
import InsightCards from '../components/InsightCards';

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-accent/10 text-accent',
  warning: 'bg-yellow-500/10 text-yellow-400',
  critical: 'bg-danger/10 text-danger',
};

/**
 * Builds a snapshot from the same widget data model as Home.tsx.
 * In production this would call the backend; here we derive it from the
 * dashboard's existing data shape so the agent is always in sync.
 */
function buildSnapshotFromDashboard(): DashboardSnapshot {
  return {
    orgId: localStorage.getItem('orgPublicKey') ?? 'local',
    totalPayments: Number(localStorage.getItem('insight_totalPayments')) || 0,
    successfulPayments: Number(localStorage.getItem('insight_successfulPayments')) || 0,
    failedPayments: Number(localStorage.getItem('insight_failedPayments')) || 0,
    pendingPayments: Number(localStorage.getItem('insight_pendingPayments')) || 0,
    activeEmployees: Number(localStorage.getItem('insight_activeEmployees')) || 0,
    inactiveEmployees: Number(localStorage.getItem('insight_inactiveEmployees')) || 0,
    newEmployeesThisPeriod: Number(localStorage.getItem('insight_newEmployees')) || 0,
    complianceFlags: Number(localStorage.getItem('insight_complianceFlags')) || 0,
    auditIssues: Number(localStorage.getItem('insight_auditIssues')) || 0,
    routingErrors: Number(localStorage.getItem('insight_routingErrors')) || 0,
    averageSettlementTimeMs: Number(localStorage.getItem('insight_avgSettlementMs')) || 0,
    totalVolume: Number(localStorage.getItem('insight_totalVolume')) || 0,
    previousPeriodVolume: Number(localStorage.getItem('insight_prevVolume')) || 0,
    timestamp: new Date().toISOString(),
  };
}

export default function InsightsDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [report, setReport] = useState<InsightReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    // Simulate a short delay to show loading state
    const timer = setTimeout(() => {
      const snap = buildSnapshotFromDashboard();
      setReport(generateInsightReport(snap));
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanup = refresh();
    return cleanup;
  }, [refresh]);

  const severity = report ? worstSeverity(report) : null;

  return (
    <main className="flex min-h-[80vh] flex-col px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8">
        {/* Header */}
        <section className="card glass noise rounded-[1.75rem] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
                Agent Report
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-text">
                Real-Time <span className="text-accent">Insights</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted max-w-xl">
                Agent-generated insight cards sourced from your live dashboard data.
                Cards update automatically as your metrics change.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {severity && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${SEVERITY_BADGE[severity] ?? ''}`}
                >
                  {severity === 'critical' ? '◆' : severity === 'warning' ? '▲' : '●'}{' '}
                  {severity}
                </span>
              )}
              <button
                type="button"
                onClick={refresh}
                disabled={isLoading}
                aria-label="Refresh insights"
                className="rounded-xl border border-hi px-4 py-2 text-sm font-semibold text-text transition-all hover:border-accent/50 hover:bg-white/5 disabled:opacity-50"
              >
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Back to dashboard"
                className="rounded-xl border border-hi px-4 py-2 text-sm font-semibold text-muted transition-all hover:border-accent/50 hover:bg-white/5"
              >
                Dashboard
              </button>
            </div>
          </div>

          {report && (
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
              <span>
                Window: {new Date(report.windowStart).toLocaleDateString()} – {new Date(report.windowEnd).toLocaleDateString()}
              </span>
              <span>•</span>
              <span>{report.cards.length} insight{report.cards.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>Generated {new Date(report.generatedAt).toLocaleTimeString()}</span>
            </div>
          )}
        </section>

        {/* Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="glass noise rounded-2xl border border-hi p-5 animate-pulse"
              >
                <div className="h-3 w-20 bg-surface-hi rounded mb-3" />
                <div className="h-5 w-40 bg-surface-hi rounded mb-2" />
                <div className="h-3 w-full bg-surface-hi rounded mb-1" />
                <div className="h-3 w-3/4 bg-surface-hi rounded mb-4" />
                <div className="h-8 w-24 bg-surface-hi rounded" />
              </div>
            ))}
          </div>
        ) : report ? (
          <InsightCards cards={report.cards} />
        ) : null}

        {/* Export entry point */}
        {report && report.cards.length > 0 && (
          <section className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                const json = JSON.stringify(report, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `insight-report-${report.orgId}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              aria-label="Export insight report as JSON"
              className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-bg shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02]"
            >
              Export Report (JSON)
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
