import { CheckCircle, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreflightCheck } from '../hooks/usePreflightCheck';
import type { PreflightCheckEmployee, PreflightCheckResult } from '../services/preflightCheck';

interface PreflightCheckPanelProps {
  batch: PreflightCheckEmployee[];
}

function generateFailureCsv(results: PreflightCheckResult[]): void {
  const failed = results.filter((r) => r.status === 'fail');
  if (failed.length === 0) return;

  const rows = failed.map(
    (r) =>
      `"${r.employeeName.replace(/"/g, '""')}","${r.walletAddress}","${r.issues.map((i) => i.message.replace(/"/g, '""')).join('; ')}"`
  );
  const csvContent = ['"Employee Name","Wallet Address","Issues"', ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `preflight-failures-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function PreflightCheckPanel({ batch }: PreflightCheckPanelProps) {
  const { t } = useTranslation();
  const { results, isRunning, summary, rerun } = usePreflightCheck(batch);

  if (batch.length === 0) return null;

  const failedCount = results.filter((r) => r.status === 'fail').length;

  return (
    <div className="space-y-4" role="region" aria-label={t('preflight.resultsAriaLabel')}>
      <div
        className={`rounded-xl border p-4 ${
          isRunning
            ? 'border-[var(--border-hi)] bg-[var(--surface)]/95'
            : summary.readyToSubmit
              ? 'border-[rgba(63,185,80,0.28)] bg-[rgba(63,185,80,0.08)]'
              : 'border-[rgba(255,123,114,0.28)] bg-[rgba(255,123,114,0.08)]'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          {isRunning ? (
            <Loader2 className="w-5 h-5 text-[var(--muted)] animate-spin" aria-hidden="true" />
          ) : summary.readyToSubmit ? (
            <CheckCircle className="w-5 h-5 text-[var(--success)]" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-[var(--danger)]" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold text-[var(--text)]">
            {isRunning
              ? t('preflight.runningChecks')
              : summary.readyToSubmit
                ? t('preflight.readyToSubmit')
                : t('preflight.issuesDetected')}
          </span>
          {!isRunning && results.length > 0 && (
            <span className="text-xs text-[var(--muted)] ml-auto">
              {t('preflight.passedFailedCount', {
                passed: summary.totalPassed,
                failed: summary.totalFailed,
              })}
            </span>
          )}
        </div>
        {!isRunning && failedCount > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[var(--muted)]">
              {t('preflight.resolveIssuesPrompt')}
            </span>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="card border-[var(--border-hi)] bg-[var(--surface)]/95 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[var(--text)]">
              {t('preflight.resultsTitle')}
            </h3>
            <div className="flex items-center gap-2">
              {failedCount > 0 && (
                <button
                  onClick={() => generateFailureCsv(results)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--bg)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--accent)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  title={t('preflight.downloadFailureReport')}
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('preflight.exportFailures')}
                </button>
              )}
              <button
                onClick={() => rerun()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hi)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hi)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                title={t('preflight.rerunChecks')}
              >
                <Loader2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t('preflight.rerun')}
              </button>
            </div>
          </div>

          <div
            className="overflow-x-auto rounded-xl border border-[var(--border-hi)]"
            role="table"
            aria-label={t('preflight.tableAriaLabel')}
          >
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-hi)] bg-[var(--surface-hi)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('preflight.columnEmployee')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('preflight.columnWalletAddress')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('preflight.columnStatus')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t('preflight.columnIssues')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {results.map((result) => (
                  <tr
                    key={result.walletAddress}
                    className={`transition-colors ${
                      result.status === 'pass'
                        ? 'hover:bg-[var(--surface-hi)]'
                        : 'bg-[rgba(255,123,114,0.04)] hover:bg-[rgba(255,123,114,0.08)]'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {result.employeeName}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-[var(--muted)]">
                      {result.walletAddress}
                    </td>
                    <td className="px-4 py-3">
                      {result.status === 'pass' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(63,185,80,0.1)] px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
                          <CheckCircle className="w-3 h-3" aria-hidden="true" />
                          {t('preflight.pass')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,123,114,0.1)] px-2.5 py-0.5 text-xs font-medium text-[var(--danger)]">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          {t('preflight.fail')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {result.issues.length > 0 ? (
                        <ul className="space-y-1 list-none p-0 m-0">
                          {result.issues.map((issue) => (
                            <li
                              key={`${issue.type}-${issue.message.slice(0, 20)}`}
                              className="text-[var(--danger)]"
                            >
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[var(--success)] font-medium">
                          {t('preflight.noIssues')}
                        </span>
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
}
