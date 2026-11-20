// Fixture data for RateLimitUsageReportAgent tests.

export const FIXTURE_USAGE_ROWS = [
  { identifier: 'user-1', tier: 'api', used: 90, remaining: 10, limit_value: 100, reset_at: new Date('2024-06-01T12:00:00Z') },
  { identifier: 'user-2', tier: 'api', used: 50, remaining: 50, limit_value: 100, reset_at: new Date('2024-06-01T12:00:00Z') },
  { identifier: 'user-3', tier: 'auth', used: 18, remaining: 2, limit_value: 20, reset_at: new Date('2024-06-01T12:00:00Z') },
  { identifier: 'user-4', tier: 'data', used: 5, remaining: 95, limit_value: 100, reset_at: new Date('2024-06-01T12:00:00Z') },
  { identifier: 'user-5', tier: 'api', used: 95, remaining: 5, limit_value: 100, reset_at: new Date('2024-06-01T12:00:00Z') },
];

export const FIXTURE_EXPECTED = {
  totalIdentifiers: 5,
  totalTiers: 3,
  nearThresholdCountDefault: 3, // >= 80%: user-1 (90%), user-3 (90%), user-5 (95%)
  nearThresholdCount50: 4, // >= 50%: user-1 (90%), user-2 (50%), user-3 (90%), user-5 (95%)
  apiUsedTotal: 235, // 90+50+95
  authUsedTotal: 18,
  dataUsedTotal: 5,
  topConsumerId: 'user-1',
} as const;
