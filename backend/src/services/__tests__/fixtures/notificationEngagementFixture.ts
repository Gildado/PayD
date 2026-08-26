// Fixture data for NotificationEngagementReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 42;

export interface FixtureNotificationRow {
  id: number;
  organization_id: number;
  employee_id: number;
  transaction_id: number;
  notification_type: 'email' | 'push';
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  created_at: Date;
}

const BASE = new Date('2024-06-01T00:00:00Z');

export const FIXTURE_ROWS: FixtureNotificationRow[] = [
  { id: 1, organization_id: FIXTURE_ORG_ID, employee_id: 10, transaction_id: 100, notification_type: 'email', status: 'sent', error_message: null, created_at: new Date(+BASE) },
  { id: 2, organization_id: FIXTURE_ORG_ID, employee_id: 10, transaction_id: 101, notification_type: 'email', status: 'sent', error_message: null, created_at: new Date(+BASE + 60_000) },
  { id: 3, organization_id: FIXTURE_ORG_ID, employee_id: 10, transaction_id: 102, notification_type: 'push', status: 'sent', error_message: null, created_at: new Date(+BASE + 120_000) },
  { id: 4, organization_id: FIXTURE_ORG_ID, employee_id: 20, transaction_id: 103, notification_type: 'email', status: 'failed', error_message: 'SMTP timeout', created_at: new Date(+BASE + 180_000) },
  { id: 5, organization_id: FIXTURE_ORG_ID, employee_id: 20, transaction_id: 104, notification_type: 'push', status: 'failed', error_message: 'Device token invalid', created_at: new Date(+BASE + 240_000) },
  { id: 6, organization_id: FIXTURE_ORG_ID, employee_id: 30, transaction_id: 105, notification_type: 'email', status: 'pending', error_message: null, created_at: new Date(+BASE + 300_000) },
  { id: 7, organization_id: FIXTURE_ORG_ID, employee_id: 30, transaction_id: 106, notification_type: 'push', status: 'sent', error_message: null, created_at: new Date(+BASE + 360_000) },
];

// Pre-computed expected values.
export const FIXTURE_EXPECTED = {
  total: 7,
  sent: 4,
  failed: 2,
  pending: 1,
  deliveryRate: Math.round((4 / 7) * 10000) / 100, // 57.14
  emailTotal: 4,
  emailSent: 2,
  emailFailed: 1,
  emailPending: 1,
  emailDeliveryRate: Math.round((2 / 4) * 10000) / 100, // 50
  pushTotal: 3,
  pushSent: 2,
  pushFailed: 1,
  pushPending: 0,
  pushDeliveryRate: Math.round((2 / 3) * 10000) / 100, // 66.67
  byEmployeeCount: 3,
  failureLimit: 2,
} as const;
