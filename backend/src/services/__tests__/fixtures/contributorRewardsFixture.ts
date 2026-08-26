// Fixture data for ContributorRewardsReportAgent tests.

export const FIXTURE_REWARD_ROWS = [
  { id: 1, contributor_address: 'GABC1', tier: 'minor', amount: 100, issue_number: 101, status: 'distributed', distributed_at: new Date('2024-06-01T10:00:00Z') },
  { id: 2, contributor_address: 'GABC2', tier: 'major', amount: 500, issue_number: 102, status: 'distributed', distributed_at: new Date('2024-06-02T10:00:00Z') },
  { id: 3, contributor_address: 'GABC1', tier: 'minor', amount: 100, issue_number: 103, status: 'distributed', distributed_at: new Date('2024-06-03T10:00:00Z') },
  { id: 4, contributor_address: 'GABC3', tier: 'critical', amount: 2000, issue_number: 104, status: 'distributed', distributed_at: new Date('2024-06-04T10:00:00Z') },
  { id: 5, contributor_address: 'GABC2', tier: 'minor', amount: 100, issue_number: 105, status: 'pending', distributed_at: new Date('2024-06-05T10:00:00Z') },
];

export const FIXTURE_EXPECTED = {
  totalRewards: 5,
  totalXlm: 2800, // 100+500+100+2000+100
  uniqueContributors: 3,
  minorCount: 3,
  minorXlm: 300,
  majorCount: 1,
  majorXlm: 500,
  criticalCount: 1,
  criticalXlm: 2000,
  topContributorAddress: 'GABC3',
  topContributorXlm: 2000,
} as const;
