// Fixture data for Sep31ComplianceTrackReportAgent tests.
// Models `sep31_cross_border_transactions` rows managed by sep31TrackingService.ts.
// Pre-computed expected values for deterministic test assertions.

export interface FixtureSep31Row {
  id: number;
  organization_id: number;
  sender_public_key: string;
  anchor_domain: string;
  anchor_transaction_id: string | null;
  stellar_transaction_id: string | null;
  status: string | null;
  created_at: Date;
}

const DAY1 = new Date('2024-05-01T00:00:00Z');
const DAY2 = new Date('2024-05-02T00:00:00Z');
const DAY3 = new Date('2024-05-03T00:00:00Z');

export const FIXTURE_ROWS: FixtureSep31Row[] = [
  { id: 1, organization_id: 1, sender_public_key: 'GA', anchor_domain: 'acme.com', anchor_transaction_id: 'at1', stellar_transaction_id: 'abc123', status: 'completed', created_at: DAY1 },
  { id: 2, organization_id: 1, sender_public_key: 'GA', anchor_domain: 'acme.com', anchor_transaction_id: 'at2', stellar_transaction_id: null, status: 'pending', created_at: DAY1 },
  { id: 3, organization_id: 1, sender_public_key: 'GB', anchor_domain: 'bob.com', anchor_transaction_id: 'at3', stellar_transaction_id: 'xyz789', status: 'completed', created_at: DAY2 },
  { id: 4, organization_id: 1, sender_public_key: 'GB', anchor_domain: 'bob.com', anchor_transaction_id: 'at4', stellar_transaction_id: null, status: null, created_at: DAY2 },
  { id: 5, organization_id: 1, sender_public_key: 'GC', anchor_domain: 'bob.com', anchor_transaction_id: 'at5', stellar_transaction_id: null, status: 'error', created_at: DAY3 },
  { id: 6, organization_id: 1, sender_public_key: 'GC', anchor_domain: 'acme.com', anchor_transaction_id: 'at6', stellar_transaction_id: 'def456', status: 'completed', created_at: DAY3 },
];

export const FIXTURE_EXPECTED = {
  total: 6,
  completed: 3, // rows 1, 3, 6
  pending: 1, // row 2
  error: 1, // row 5
  unknown: 1, // row 4 (null status)
  onChainCount: 3, // rows 1, 3, 6
  onChainRate: 50, // 3/6 * 100
  uniqueSenders: 3, // GA, GB, GC
  uniqueAnchors: 2, // acme.com, bob.com
  byStatusLength: 4,
  byAnchorLength: 2,
  trendsLength: 3,
  complianceFlagsLength: 3, // rows 2, 4, 5 (off-chain only)
} as const;
