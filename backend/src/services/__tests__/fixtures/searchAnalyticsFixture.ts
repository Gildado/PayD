// Fixture data for SearchAnalyticsReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureEmployeeRow {
  id: number;
  organization_id: number;
  department: string | null;
  position: string | null;
  base_salary: string;
  status: 'active' | 'inactive';
  wallet_address: string | null;
  deleted_at: Date | null;
}

export const FIXTURE_ROWS: FixtureEmployeeRow[] = [
  { id: 1, organization_id: FIXTURE_ORG_ID, department: 'Engineering', position: 'Dev', base_salary: '120000', status: 'active', wallet_address: '0xAAA', deleted_at: null },
  { id: 2, organization_id: FIXTURE_ORG_ID, department: 'Engineering', position: 'Dev', base_salary: '110000', status: 'active', wallet_address: '0xBBB', deleted_at: null },
  { id: 3, organization_id: FIXTURE_ORG_ID, department: 'Engineering', position: 'Manager', base_salary: '130000', status: 'active', wallet_address: '0xCCC', deleted_at: null },
  { id: 4, organization_id: FIXTURE_ORG_ID, department: 'Sales', position: 'Rep', base_salary: '90000', status: 'active', wallet_address: '0xDDD', deleted_at: null },
  { id: 5, organization_id: FIXTURE_ORG_ID, department: 'Sales', position: 'Rep', base_salary: '85000', status: 'active', wallet_address: null, deleted_at: null },
  { id: 6, organization_id: FIXTURE_ORG_ID, department: 'HR', position: 'Lead', base_salary: '95000', status: 'active', wallet_address: '0xEEE', deleted_at: null },
  { id: 7, organization_id: FIXTURE_ORG_ID, department: null, position: 'Intern', base_salary: '30000', status: 'active', wallet_address: null, deleted_at: null },
  { id: 8, organization_id: FIXTURE_ORG_ID, department: 'Engineering', position: 'Dev', base_salary: '100000', status: 'inactive', wallet_address: '0xFFF', deleted_at: new Date('2024-03-01') },
];

export interface FixtureTxRow {
  total: number;
}

export const FIXTURE_TX_ROWS: FixtureTxRow[] = [{ total: 15 }];

// Pre-computed expected values.
export const FIXTURE_EXPECTED = {
  totalEmployees: 8,
  activeEmployees: 7,
  inactiveEmployees: 1,
  totalDepartments: 4, // Engineering, Sales, HR, null
  totalPositions: 5, // Dev, Manager, Rep, Lead, Intern
  totalTransactions: 15,
  departmentsList: ['Engineering', 'Sales', 'HR'],
  positionsList: ['Dev', 'Manager', 'Rep', 'Lead', 'Intern'],
  engineeringCount: 2, // only active: ids 1,2 (id 8 is inactive)
  salesCount: 2, // active: ids 4,5
  hrCount: 1, // active: id 6
  // Zero-result areas: HR has 1 employee -> flagged
  zeroResultAreas: expect.arrayContaining([
    expect.stringContaining('HR'),
  ]),
} as const;
