// Fixture data for VestingScheduleProjectionReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureVestingGrantRow {
  id: number;
  organization_id: number;
  employee_id: number;
  status: string;
  total_amount: number;
  vested_amount: number;
  claimed_amount: number;
  next_vesting_date: Date | null;
  next_vesting_amount: number;
  start_date: Date;
}

export interface FixtureEmployeeRow {
  id: number;
  organization_id: number;
  first_name: string;
  last_name: string;
}

const NOW = new Date('2024-03-15T12:00:00Z');
const NEXT_WEEK = new Date('2024-03-22T12:00:00Z');
const NEXT_MONTH = new Date('2024-04-15T12:00:00Z');
const TWO_MONTHS = new Date('2024-05-15T12:00:00Z');
const START_DATE = new Date('2023-03-15T12:00:00Z');

export const FIXTURE_EMPLOYEES: FixtureEmployeeRow[] = [
  { id: 1, organization_id: FIXTURE_ORG_ID, first_name: 'Alice', last_name: 'A' },
  { id: 2, organization_id: FIXTURE_ORG_ID, first_name: 'Bob', last_name: 'B' },
  { id: 3, organization_id: FIXTURE_ORG_ID, first_name: 'Carol', last_name: 'C' },
];

export const FIXTURE_GRANTS: FixtureVestingGrantRow[] = [
  // Alice - 2 active grants
  { id: 1, organization_id: FIXTURE_ORG_ID, employee_id: 1, status: 'active', total_amount: 100000, vested_amount: 40000, claimed_amount: 30000, next_vesting_date: NEXT_WEEK, next_vesting_amount: 10000, start_date: START_DATE },
  { id: 2, organization_id: FIXTURE_ORG_ID, employee_id: 1, status: 'active', total_amount: 50000, vested_amount: 20000, claimed_amount: 15000, next_vesting_date: NEXT_MONTH, next_vesting_amount: 5000, start_date: START_DATE },
  
  // Bob - 1 active grant
  { id: 3, organization_id: FIXTURE_ORG_ID, employee_id: 2, status: 'active', total_amount: 80000, vested_amount: 30000, claimed_amount: 25000, next_vesting_date: NEXT_WEEK, next_vesting_amount: 8000, start_date: START_DATE },
  
  // Carol - 1 active grant
  { id: 4, organization_id: FIXTURE_ORG_ID, employee_id: 3, status: 'active', total_amount: 120000, vested_amount: 50000, claimed_amount: 50000, next_vesting_date: TWO_MONTHS, next_vesting_amount: 12000, start_date: START_DATE },
];

// Pre-computed expected values
export const FIXTURE_EXPECTED = {
  totalActiveGrants: 4,
  totalGrantedAmount: 350000, // 100000+50000+80000+120000
  totalVestedAmount: 140000, // 40000+20000+30000+50000
  totalClaimedAmount: 120000, // 30000+15000+25000+50000
  totalUnvestedAmount: 210000, // 350000-140000
  
  // Upcoming releases in next 30 days
  upcomingReleases30Days: 2, // Alice grant 1 and Bob grant 3 (both NEXT_WEEK)
  upcomingAmount30Days: 18000, // 10000+8000
  
  // Alice totals
  alice: {
    totalGranted: 150000,
    totalVested: 60000,
    totalClaimed: 45000,
    totalUnvested: 90000,
    nextVestingAmount: 10000, // earliest is grant 1
    grantCount: 2,
  },
  
  // Bob totals
  bob: {
    totalGranted: 80000,
    totalVested: 30000,
    totalClaimed: 25000,
    totalUnvested: 50000,
    nextVestingAmount: 8000,
    grantCount: 1,
  },
  
  // Carol totals
  carol: {
    totalGranted: 120000,
    totalVested: 50000,
    totalClaimed: 50000,
    totalUnvested: 70000,
    nextVestingAmount: 12000,
    grantCount: 1,
  },
} as const;
