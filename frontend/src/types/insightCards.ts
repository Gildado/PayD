/** Severity level for an insight card. */
export type InsightSeverity = 'info' | 'warning' | 'critical';

/** Category that the insight pertains to. */
export type InsightCategory = 'payments' | 'roster' | 'controls' | 'routing';

/** A single agent-generated insight card. */
export interface InsightCard {
  id: string;
  title: string;
  summary: string;
  severity: InsightSeverity;
  category: InsightCategory;
  metric: string;
  metricLabel: string;
  generatedAt: string; // ISO 8601
}

/** The full report output from the insight card agent. */
export interface InsightReport {
  orgId: string;
  windowStart: string; // ISO 8601
  windowEnd: string; // ISO 8601
  generatedAt: string; // ISO 8601
  cards: InsightCard[];
}

/** Input data the agent uses to generate insight cards. */
export interface DashboardSnapshot {
  orgId: string;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  activeEmployees: number;
  inactiveEmployees: number;
  newEmployeesThisPeriod: number;
  complianceFlags: number;
  auditIssues: number;
  routingErrors: number;
  averageSettlementTimeMs: number;
  totalVolume: number;
  previousPeriodVolume: number;
  timestamp: string; // ISO 8601
}
