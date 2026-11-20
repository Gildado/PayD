jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/tracing.js', () => ({
  withSpan: jest.fn((_name, _attributes, operation) => operation()),
}));
jest.mock('../../services/notificationService.js', () => ({
  NotificationService: jest.fn(),
}));

import { pool } from '../../config/database.js';
import { VestingReleaseNotificationScheduler } from '../../workers/vestingReleaseNotificationScheduler.js';

describe('vesting release notification scheduler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('dispatches each due grant using its organization scope', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rows: [
        { id: 12, organization_id: 3 },
        { id: 13, organization_id: 4 },
      ],
    });
    const workflow = { execute: jest.fn().mockResolvedValue({ status: 'completed' }) };
    const scheduler = new VestingReleaseNotificationScheduler(workflow as never, 60_000);

    await scheduler.scan();

    expect((pool.query as jest.Mock).mock.calls[0][0]).toContain(
      "notification.status IN ('sent', 'skipped')"
    );
    expect(workflow.execute).toHaveBeenNthCalledWith(
      1,
      { id: 0, organizationId: 3, role: 'EMPLOYER' },
      { grantId: 12 }
    );
    expect(workflow.execute).toHaveBeenNthCalledWith(
      2,
      { id: 0, organizationId: 4, role: 'EMPLOYER' },
      { grantId: 13 }
    );
  });

  test('does not overlap scans while a previous database query is pending', async () => {
    let resolveQuery!: (value: { rows: never[] }) => void;
    (pool.query as jest.Mock).mockImplementation(
      () => new Promise((resolve) => (resolveQuery = resolve))
    );
    const workflow = { execute: jest.fn() };
    const scheduler = new VestingReleaseNotificationScheduler(workflow as never, 60_000);

    const firstScan = scheduler.scan();
    await scheduler.scan();
    expect(pool.query).toHaveBeenCalledTimes(1);
    resolveQuery({ rows: [] });
    await firstScan;
  });
});
