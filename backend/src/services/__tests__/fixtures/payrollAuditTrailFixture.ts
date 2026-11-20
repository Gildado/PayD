// Fixture data for PayrollAuditTrailReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureAuditLogRow {
  id: number;
  organization_id: number;
  action: string;
  actor_type: string;
  actor_email: string | null;
  employee_id: number | null;
  amount: string | null;
  tx_hash: string | null;
  old_status: string | null;
  new_status: string | null;
  error_message: string | null;
  created_at: Date;
}

const BASE = new Date('2024-06-01T00:00:00Z');

export const FIXTURE_ROWS: FixtureAuditLogRow[] = [
  { id: 1, organization_id: FIXTURE_ORG_ID, action: 'run_created', actor_type: 'user', actor_email: 'admin@example.com', employee_id: null, amount: null, tx_hash: null, old_status: null, new_status: null, error_message: null, created_at: BASE },
  { id: 2, organization_id: FIXTURE_ORG_ID, action: 'item_added', actor_type: 'user', actor_email: 'admin@example.com', employee_id: 10, amount: '500.00', tx_hash: null, old_status: null, new_status: null, error_message: null, created_at: new Date(+BASE + 60_000) },
  { id: 3, organization_id: FIXTURE_ORG_ID, action: 'item_added', actor_type: 'user', actor_email: 'admin@example.com', employee_id: 20, amount: '750.50', tx_hash: null, old_status: null, new_status: null, error_message: null, created_at: new Date(+BASE + 120_000) },
  { id: 4, organization_id: FIXTURE_ORG_ID, action: 'transaction_submitted', actor_type: 'system', actor_email: null, employee_id: 10, amount: '500.00', tx_hash: 'tx-abc-001', old_status: null, new_status: null, error_message: null, created_at: new Date(+BASE + 180_000) },
  { id: 5, organization_id: FIXTURE_ORG_ID, action: 'transaction_succeeded', actor_type: 'system', actor_email: null, employee_id: 10, amount: '500.00', tx_hash: 'tx-abc-001', old_status: null, new_status: null, error_message: null, created_at: new Date(+BASE + 240_000) },
  { id: 6, organization_id: FIXTURE_ORG_ID, action: 'transaction_submitted', actor_type: 'system', actor_email: null, employee_id: 20, amount: '750.50', tx_hash: 'tx-abc-002', old_status: null, new_status: null, error_message: null, created_at: new Date(+BASE + 300_000) },
  { id: 7, organization_id: FIXTURE_ORG_ID, action: 'transaction_failed', actor_type: 'system', actor_email: null, employee_id: 20, amount: '750.50', tx_hash: 'tx-abc-002', old_status: null, new_status: null, error_message: 'Insufficient funds', created_at: new Date(+BASE + 360_000) },
  { id: 8, organization_id: FIXTURE_ORG_ID, action: 'item_status_changed', actor_type: 'user', actor_email: 'admin@example.com', employee_id: 20, amount: null, tx_hash: null, old_status: 'pending', new_status: 'failed', error_message: null, created_at: new Date(+BASE + 420_000) },
];

// Pre-computed expected values.
export const FIXTURE_EXPECTED = {
  totalActions: 8,
  successfulTransactions: 1,
  failedTransactions: 1,
  totalAmountTransacted: '500.00', // only transaction_succeeded amounts
  byActionCounts: {
    run_created: 1,
    item_added: 2,
    transaction_submitted: 2,
    transaction_succeeded: 1,
    transaction_failed: 1,
    item_status_changed: 1,
  },
  byActorCounts: {
    user: 4,
    system: 4,
  },
  timelineLimit: 50,
  flaggedLimit: 20,
} as const;
