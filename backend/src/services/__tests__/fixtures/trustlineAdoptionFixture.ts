// Fixture data for TrustlineAdoptionReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureEmployeeRow {
  id: number;
  organization_id: number;
  first_name: string;
  last_name: string;
  department: string | null;
  deleted_at: Date | null;
}

export interface FixtureTrustlineRow {
  id: number;
  employee_id: number;
  wallet_address: string;
  asset_code: string;
  asset_issuer: string;
  status: string;
  balance: string;
  last_checked_at: Date;
}

const NOW = new Date('2024-03-15T12:00:00Z');

export const FIXTURE_EMPLOYEES: FixtureEmployeeRow[] = [
  // Engineering - all 3 have trustlines
  { id: 1, organization_id: FIXTURE_ORG_ID, first_name: 'Alice', last_name: 'A', department: 'Engineering', deleted_at: null },
  { id: 2, organization_id: FIXTURE_ORG_ID, first_name: 'Bob', last_name: 'B', department: 'Engineering', deleted_at: null },
  { id: 3, organization_id: FIXTURE_ORG_ID, first_name: 'Carol', last_name: 'C', department: 'Engineering', deleted_at: null },
  
  // Sales - only 1 of 2 has trustlines
  { id: 4, organization_id: FIXTURE_ORG_ID, first_name: 'Dave', last_name: 'D', department: 'Sales', deleted_at: null },
  { id: 5, organization_id: FIXTURE_ORG_ID, first_name: 'Eve', last_name: 'E', department: 'Sales', deleted_at: null },
];

export const FIXTURE_TRUSTLINES: FixtureTrustlineRow[] = [
  // Alice - USDC and EURC
  { id: 1, employee_id: 1, wallet_address: 'GALICE...', asset_code: 'USDC', asset_issuer: 'GISSUER1...', status: 'established', balance: '1000.0000000', last_checked_at: NOW },
  { id: 2, employee_id: 1, wallet_address: 'GALICE...', asset_code: 'EURC', asset_issuer: 'GISSUER2...', status: 'established', balance: '500.0000000', last_checked_at: NOW },
  
  // Bob - USDC only
  { id: 3, employee_id: 2, wallet_address: 'GBOB...', asset_code: 'USDC', asset_issuer: 'GISSUER1...', status: 'established', balance: '2000.0000000', last_checked_at: NOW },
  
  // Carol - USDC and EURC
  { id: 4, employee_id: 3, wallet_address: 'GCAROL...', asset_code: 'USDC', asset_issuer: 'GISSUER1...', status: 'established', balance: '1500.0000000', last_checked_at: NOW },
  { id: 5, employee_id: 3, wallet_address: 'GCAROL...', asset_code: 'EURC', asset_issuer: 'GISSUER2...', status: 'established', balance: '750.0000000', last_checked_at: NOW },
  
  // Dave - USDC only
  { id: 6, employee_id: 4, wallet_address: 'GDAVE...', asset_code: 'USDC', asset_issuer: 'GISSUER1...', status: 'established', balance: '800.0000000', last_checked_at: NOW },
  
  // Eve - no trustlines
];

// Pre-computed expected values
export const FIXTURE_EXPECTED = {
  totalEmployees: 5,
  totalWithTrustlines: 4, // Alice, Bob, Carol, Dave (Eve has none)
  adoptionRate: 80, // 4/5 * 100
  totalAssets: 2, // USDC and EURC
  totalTrustlines: 6,
  avgTrustlinesPerEmployee: 1.5, // 6 trustlines / 4 employees with trustlines
  
  // By asset
  usdc: {
    trustlinesEstablished: 4, // Alice, Bob, Carol, Dave
    adoptionRate: 80, // 4/5 * 100
    avgBalance: 1325, // (1000+2000+1500+800)/4
  },
  eurc: {
    trustlinesEstablished: 2, // Alice, Carol
    adoptionRate: 40, // 2/5 * 100
    avgBalance: 625, // (500+750)/2
  },
  
  // By department
  engineering: {
    totalEmployees: 3,
    trustlinesEstablished: 3,
    adoptionRate: 100, // 3/3 * 100
    assetsUsed: 2,
  },
  sales: {
    totalEmployees: 2,
    trustlinesEstablished: 1, // only Dave
    adoptionRate: 50, // 1/2 * 100
    assetsUsed: 1,
  },
} as const;
