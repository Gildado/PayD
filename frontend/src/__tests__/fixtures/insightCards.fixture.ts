import type { DashboardSnapshot } from '../../types/insightCards';

/**
 * Fixture dataset with known values so tests can assert exact insight output.
 *
 * Scenario: a mid-size org with some failures, pending payments, compliance
 * flags, and elevated settlement times — enough to trigger cards in every
 * category at mixed severity levels.
 */
export const HEALTHY_SNAPSHOT: DashboardSnapshot = {
  orgId: 'org-fixture-001',
  totalPayments: 200,
  successfulPayments: 195,
  failedPayments: 3,
  pendingPayments: 2,
  activeEmployees: 50,
  inactiveEmployees: 2,
  newEmployeesThisPeriod: 3,
  complianceFlags: 0,
  auditIssues: 0,
  routingErrors: 0,
  averageSettlementTimeMs: 4500,
  totalVolume: 120_000,
  previousPeriodVolume: 115_000,
  timestamp: '2026-01-15T12:00:00.000Z',
};

export const DEGRADED_SNAPSHOT: DashboardSnapshot = {
  orgId: 'org-fixture-002',
  totalPayments: 100,
  successfulPayments: 78,
  failedPayments: 15,
  pendingPayments: 7,
  activeEmployees: 40,
  inactiveEmployees: 12,
  newEmployeesThisPeriod: 0,
  complianceFlags: 3,
  auditIssues: 2,
  routingErrors: 6,
  averageSettlementTimeMs: 180_000,
  totalVolume: 80_000,
  previousPeriodVolume: 120_000,
  timestamp: '2026-01-15T12:00:00.000Z',
};

export const EMPTY_SNAPSHOT: DashboardSnapshot = {
  orgId: 'org-fixture-empty',
  totalPayments: 0,
  successfulPayments: 0,
  failedPayments: 0,
  pendingPayments: 0,
  activeEmployees: 0,
  inactiveEmployees: 0,
  newEmployeesThisPeriod: 0,
  complianceFlags: 0,
  auditIssues: 0,
  routingErrors: 0,
  averageSettlementTimeMs: 0,
  totalVolume: 0,
  previousPeriodVolume: 0,
  timestamp: '2026-01-15T12:00:00.000Z',
};

/**
 * Expected card IDs for each fixture, derived by hand from the agent rules.
 * Tests compare against these to lock the output contract.
 */
export const EXPECTED = {
  healthy: {
    cardCount: 6,
    ids: [
      'insight-payments-success-rate',
      'insight-payments-volume-trend',
      'insight-payments-pending',
      'insight-roster-growth',
      'insight-roster-inactive',
      'insight-routing-settlement-time',
    ],
    worstSeverity: 'info' as const,
  },
  degraded: {
    cardCount: 8,
    ids: [
      'insight-payments-success-rate',
      'insight-payments-volume-trend',
      'insight-payments-pending',
      'insight-roster-growth',
      'insight-roster-inactive',
      'insight-controls-compliance',
      'insight-routing-settlement-time',
      'insight-routing-errors',
    ],
    worstSeverity: 'critical' as const,
  },
  empty: {
    cardCount: 0,
    ids: [] as string[],
    worstSeverity: null,
  },
};
