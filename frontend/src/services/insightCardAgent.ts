import type {
  DashboardSnapshot,
  InsightCard,
  InsightCategory,
  InsightReport,
  InsightSeverity,
} from '../types/insightCards';

const DEFAULT_WINDOW_HOURS = 24;

function isoNow(): string {
  return new Date().toISOString();
}

function makeId(category: InsightCategory, suffix: string): string {
  return `insight-${category}-${suffix}`;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function severityFromDelta(deltaPct: number, thresholds: { warn: number; crit: number }): InsightSeverity {
  if (deltaPct >= thresholds.crit) return 'critical';
  if (deltaPct >= thresholds.warn) return 'warning';
  return 'info';
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}min`;
}

// ── Individual insight generators ────────────────────────────────────────────

function generatePaymentSuccessCard(snap: DashboardSnapshot): InsightCard | null {
  const total = snap.successfulPayments + snap.failedPayments;
  if (total === 0) return null;

  const rate = pct(snap.successfulPayments, total);
  const failRate = 100 - rate;
  const severity = severityFromDelta(failRate, { warn: 5, crit: 15 });

  return {
    id: makeId('payments', 'success-rate'),
    title: 'Payment Success Rate',
    summary:
      severity === 'critical'
        ? `Critical: ${failRate}% of payments failed in the last period. Immediate review recommended.`
        : severity === 'warning'
          ? `${failRate}% of payments failed — above the 5% threshold.`
          : `Payment success rate is healthy at ${rate}%.`,
    severity,
    category: 'payments',
    metric: `${rate}%`,
    metricLabel: 'Success Rate',
    generatedAt: isoNow(),
  };
}

function generateVolumeTrendCard(snap: DashboardSnapshot): InsightCard | null {
  if (snap.previousPeriodVolume === 0) return null;

  const deltaPct = pct(
    snap.totalVolume - snap.previousPeriodVolume,
    snap.previousPeriodVolume
  );
  const absDelta = Math.abs(deltaPct);
  const direction = deltaPct >= 0 ? 'up' : 'down';
  const severity = severityFromDelta(absDelta, { warn: 20, crit: 50 });

  return {
    id: makeId('payments', 'volume-trend'),
    title: 'Payroll Volume Trend',
    summary:
      severity === 'critical'
        ? `Volume ${direction} ${absDelta}% vs. previous period — investigate immediately.`
        : `Volume ${direction} ${absDelta}% compared to the previous period.`,
    severity,
    category: 'payments',
    metric: `${direction === 'up' ? '+' : ''}${deltaPct}%`,
    metricLabel: 'Volume Change',
    generatedAt: isoNow(),
  };
}

function generatePendingPaymentsCard(snap: DashboardSnapshot): InsightCard | null {
  if (snap.pendingPayments === 0) return null;

  const pendingPct = pct(snap.pendingPayments, snap.totalPayments);
  const severity = severityFromDelta(pendingPct, { warn: 10, crit: 25 });

  return {
    id: makeId('payments', 'pending'),
    title: 'Pending Payments',
    summary:
      severity === 'critical'
        ? `${snap.pendingPayments} payments (${pendingPct}%) are stuck in pending — action required.`
        : `${snap.pendingPayments} payments (${pendingPct}%) are still pending settlement.`,
    severity,
    category: 'payments',
    metric: String(snap.pendingPayments),
    metricLabel: 'Pending Count',
    generatedAt: isoNow(),
  };
}

function generateRosterGrowthCard(snap: DashboardSnapshot): InsightCard | null {
  if (snap.activeEmployees === 0) return null;

  const newPct = pct(snap.newEmployeesThisPeriod, snap.activeEmployees);
  const severity: InsightSeverity = snap.newEmployeesThisPeriod > 0 ? 'info' : 'info';

  return {
    id: makeId('roster', 'growth'),
    title: 'Roster Activity',
    summary:
      snap.newEmployeesThisPeriod > 0
        ? `${snap.newEmployeesThisPeriod} new employees added this period (${newPct}% of active roster).`
        : 'No new employees added this period.',
    severity,
    category: 'roster',
    metric: String(snap.newEmployeesThisPeriod),
    metricLabel: 'New Employees',
    generatedAt: isoNow(),
  };
}

function generateInactiveRosterCard(snap: DashboardSnapshot): InsightCard | null {
  const total = snap.activeEmployees + snap.inactiveEmployees;
  if (total === 0) return null;

  const inactivePct = pct(snap.inactiveEmployees, total);
  const severity = severityFromDelta(inactivePct, { warn: 15, crit: 30 });

  return {
    id: makeId('roster', 'inactive'),
    title: 'Inactive Employees',
    summary:
      severity === 'critical'
        ? `${snap.inactiveEmployees} employees (${inactivePct}% of roster) are inactive — review access and payroll status.`
        : `${snap.inactiveEmployees} inactive employees on roster (${inactivePct}%).`,
    severity,
    category: 'roster',
    metric: `${inactivePct}%`,
    metricLabel: 'Inactive Rate',
    generatedAt: isoNow(),
  };
}

function generateComplianceCard(snap: DashboardSnapshot): InsightCard | null {
  if (snap.complianceFlags === 0 && snap.auditIssues === 0) return null;

  const total = snap.complianceFlags + snap.auditIssues;
  const severity: InsightSeverity = snap.auditIssues > 0 ? 'critical' : 'warning';

  return {
    id: makeId('controls', 'compliance'),
    title: 'Compliance & Audit',
    summary:
      severity === 'critical'
        ? `${snap.auditIssues} audit issue(s) and ${snap.complianceFlags} compliance flag(s) detected.`
        : `${snap.complianceFlags} compliance flag(s) raised — review before next payroll cycle.`,
    severity,
    category: 'controls',
    metric: String(total),
    metricLabel: 'Total Flags',
    generatedAt: isoNow(),
  };
}

function generateSettlementTimeCard(snap: DashboardSnapshot): InsightCard | null {
  if (snap.averageSettlementTimeMs === 0) return null;

  const THRESHOLD_WARN_MS = 30_000;
  const THRESHOLD_CRIT_MS = 120_000;
  const severity = severityFromDelta(snap.averageSettlementTimeMs, {
    warn: THRESHOLD_WARN_MS,
    crit: THRESHOLD_CRIT_MS,
  });

  return {
    id: makeId('routing', 'settlement-time'),
    title: 'Settlement Speed',
    summary:
      severity === 'critical'
        ? `Average settlement time is ${formatMs(snap.averageSettlementTimeMs)} — well above target.`
        : severity === 'warning'
          ? `Average settlement time is ${formatMs(snap.averageSettlementTimeMs)} — monitor closely.`
          : `Settlements averaging ${formatMs(snap.averageSettlementTimeMs)}.`,
    severity,
    category: 'routing',
    metric: formatMs(snap.averageSettlementTimeMs),
    metricLabel: 'Avg Settlement',
    generatedAt: isoNow(),
  };
}

function generateRoutingErrorsCard(snap: DashboardSnapshot): InsightCard | null {
  if (snap.routingErrors === 0) return null;

  const severity: InsightSeverity = snap.routingErrors >= 5 ? 'critical' : 'warning';

  return {
    id: makeId('routing', 'errors'),
    title: 'Routing Errors',
    summary:
      severity === 'critical'
        ? `${snap.routingErrors} routing errors detected — payments may be misdirected.`
        : `${snap.routingErrors} routing error(s) in the last period.`,
    severity,
    category: 'routing',
    metric: String(snap.routingErrors),
    metricLabel: 'Error Count',
    generatedAt: isoNow(),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

const ALL_GENERATORS = [
  generatePaymentSuccessCard,
  generateVolumeTrendCard,
  generatePendingPaymentsCard,
  generateRosterGrowthCard,
  generateInactiveRosterCard,
  generateComplianceCard,
  generateSettlementTimeCard,
  generateRoutingErrorsCard,
];

/**
 * Generates an insight report from a dashboard snapshot.
 * Each card is produced by a deterministic rule — no LLM calls.
 */
export function generateInsightReport(snap: DashboardSnapshot): InsightReport {
  const cards: InsightCard[] = [];
  for (const gen of ALL_GENERATORS) {
    const card = gen(snap);
    if (card) cards.push(card);
  }

  const now = new Date(snap.timestamp);
  const windowStart = new Date(now.getTime() - DEFAULT_WINDOW_HOURS * 60 * 60 * 1000);

  return {
    orgId: snap.orgId,
    windowStart: windowStart.toISOString(),
    windowEnd: snap.timestamp,
    generatedAt: isoNow(),
    cards,
  };
}

/**
 * Returns the highest severity across all cards in a report.
 * Useful for badge/indicator rendering.
 */
export function worstSeverity(report: InsightReport): InsightSeverity | null {
  if (report.cards.length === 0) return null;
  const order: InsightSeverity[] = ['info', 'warning', 'critical'];
  let worst: InsightSeverity = 'info';
  for (const card of report.cards) {
    if (order.indexOf(card.severity) > order.indexOf(worst)) {
      worst = card.severity;
    }
  }
  return worst;
}

/**
 * Filters cards by category.
 */
export function cardsByCategory(report: InsightReport, category: InsightCategory): InsightCard[] {
  return report.cards.filter((c) => c.category === category);
}
