/**
 * Fixture dataset for Jurisdiction Compliance Report Agent tests.
 */

export const FIXTURE_ORG_ID = 100;

export const FIXTURE_TAX_ROWS = [
  {
    jurisdiction: 'US-CA',
    total_withheld: '12500.00',
    total_remitted: '10000.00',
    pending_remittance: '2500.00',
    record_count: 45,
    employee_count: 15,
    last_updated: '2024-05-01T12:00:00Z',
  },
  {
    jurisdiction: 'DE-BY',
    total_withheld: '8400.50',
    total_remitted: '8400.50',
    pending_remittance: '0.00',
    record_count: 30,
    employee_count: 10,
    last_updated: '2024-05-01T12:00:00Z',
  },
];

export const FIXTURE_EXPECTED = {
  totalJurisdictions: 2,
  totalWithheld: '20900.50',
  totalRemitted: '18400.50',
  totalPending: '2500.00',
  usCaStatus: 'action_needed',
  deByStatus: 'compliant',
} as const;
