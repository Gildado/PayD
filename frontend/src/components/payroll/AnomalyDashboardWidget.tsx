import { useQuery } from '@tanstack/react-query';
import { fetchAnomalySummaryDigest } from '../../services/anomalyDigestService';

interface AnomalyFinding {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  agentId: string;
  detectedAt: string;
}

interface AnomalyDigest {
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    topAgent: string | null;
  };
  anomaliesBySeverity: {
    critical: AnomalyFinding[];
    warning: AnomalyFinding[];
    info: AnomalyFinding[];
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-500 bg-red-500/10',
  warning: 'text-yellow-500 bg-yellow-500/10',
  info: 'text-blue-500 bg-blue-500/10',
};

export function AnomalyDashboardWidget({ organizationId = 1 }: { organizationId?: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['anomalyDigest', organizationId],
    queryFn: () => fetchAnomalySummaryDigest(organizationId),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 w-full animate-pulse rounded bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Anomaly Detection</h3>
        <p className="text-xs text-gray-500">Unable to load anomaly data.</p>
      </div>
    );
  }

  const digest: AnomalyDigest = data.data?.[0] ?? data;
  const { summary, anomaliesBySeverity } = digest;
  const recent = [...anomaliesBySeverity.critical, ...anomaliesBySeverity.warning].slice(0, 5);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4" data-testid="anomaly-dashboard-widget">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Anomaly Detection</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            summary.criticalCount > 0
              ? SEVERITY_COLORS.critical
              : summary.warningCount > 0
                ? SEVERITY_COLORS.warning
                : SEVERITY_COLORS.info
          }`}
        >
          {summary.totalAnomalies} total
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-red-400">{summary.criticalCount}</div>
          <div className="text-xs text-gray-500">Critical</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-yellow-400">{summary.warningCount}</div>
          <div className="text-xs text-gray-500">Warning</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-400">{summary.infoCount}</div>
          <div className="text-xs text-gray-500">Info</div>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className="space-y-1.5">
          {recent.map((finding) => (
            <div
              key={finding.id}
              className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${SEVERITY_COLORS[finding.severity]}`}
            >
              <span className="mt-0.5 shrink-0">
                {finding.severity === 'critical' ? '🔴' : finding.severity === 'warning' ? '🟡' : '🔵'}
              </span>
              <div className="min-w-0">
                <div className="font-medium truncate">{finding.title}</div>
                <div className="opacity-70 truncate">{finding.agentId}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">No recent anomalies</p>
      )}
    </div>
  );
}
