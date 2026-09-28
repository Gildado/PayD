// Fixture data for EmployeeTurnoverReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureEmployeeRow {
  id: number;
  organization_id: number;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  base_salary: string;
  base_currency: string;
  status: 'active' | 'inactive';
  hire_date: Date | null;
  deleted_at: Date | null;
}

const HIRE = new Date('2023-01-15T00:00:00Z');
const FIRED = new Date('2024-03-01T00:00:00Z');

export const FIXTURE_ROWS: FixtureEmployeeRow[] = [
  // Active employees
  { id: 1, organization_id: FIXTURE_ORG_ID, first_name: 'Alice', last_name: 'A', department: 'Engineering', position: 'Dev', base_salary: '120000', base_currency: 'USDC', status: 'active', hire_date: HIRE, deleted_at: null },
  { id: 2, organization_id: FIXTURE_ORG_ID, first_name: 'Bob', last_name: 'B', department: 'Engineering', position: 'Dev', base_salary: '110000', base_currency: 'USDC', status: 'active', hire_date: HIRE, deleted_at: null },
  { id: 3, organization_id: FIXTURE_ORG_ID, first_name: 'Carol', last_name: 'C', department: 'Sales', position: 'Rep', base_salary: '90000', base_currency: 'USDC', status: 'active', hire_date: HIRE, deleted_at: null },
  // Turned-over employees (soft-deleted)
  { id: 4, organization_id: FIXTURE_ORG_ID, first_name: 'Dave', last_name: 'D', department: 'Engineering', position: 'Dev', base_salary: '100000', base_currency: 'USDC', status: 'inactive', hire_date: HIRE, deleted_at: FIRED },
  { id: 5, organization_id: FIXTURE_ORG_ID, first_name: 'Eve', last_name: 'E', department: 'Sales', position: 'Rep', base_salary: '85000', base_currency: 'USDC', status: 'inactive', hire_date: HIRE, deleted_at: FIRED },
];

// Pre-computed expected values.
export const FIXTURE_EXPECTED = {
  totalActive: 3,
  totalTurnedOver: 2,
  turnoverRate: Math.round((2 / 5) * 10000) / 100, // 40
  avgBaseSalary: '106666.67', // (120000+110000+90000+100000+85000)/5 = 101000 but avg of active only = (120000+110000+90000)/3 = 106666.67
  estimatedPayrollImpact: '185000', // 2 * 92500 (avg of turned-over: (100000+85000)/2 = 92500)
  engineeringTotal: 3,
  engineeringTurnedOver: 1,
  engineeringTurnoverRate: Math.round((1 / 3) * 10000) / 100,
  salesTotal: 2,
  salesTurnedOver: 1,
  salesTurnoverRate: Math.round((1 / 2) * 10000) / 100,
} as const;
