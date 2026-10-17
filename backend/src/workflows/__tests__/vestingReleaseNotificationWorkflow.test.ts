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

import { employer, employee, MemoryWorkflowStore } from './fixtures.js';
import {
  VestingReleaseNotificationWorkflow,
  type WorkflowNotifier,
  type VestingRelease,
} from '../vestingReleaseNotificationWorkflow.js';

const dueRelease: VestingRelease = {
  id: 42,
  organization_id: 1,
  employee_id: 20,
  next_vesting_date: new Date(Date.now() - 60_000),
  next_vesting_amount: '250.0000000',
};

function createNotifier() {
  return {
    sendWorkflowNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'mail-1' }),
  } satisfies jest.Mocked<WorkflowNotifier>;
}

describe('vesting release notification workflow #1240', () => {
  test('sends and records a due tranche notification once', async () => {
    const store = new MemoryWorkflowStore();
    const notifier = createNotifier();
    const workflow = new VestingReleaseNotificationWorkflow(
      store,
      notifier,
      async () => dueRelease,
      0
    );

    const first = await workflow.execute(employer, { grantId: 42 });
    const repeated = await workflow.execute(employer, { grantId: 42 });

    expect(first.output?.status).toBe('sent');
    expect(repeated.output).toEqual(first.output);
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledTimes(1);
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 1,
        employeeId: 20,
        title: 'Vesting tranche is releasable',
      })
    );
  });

  test('allows retry after a failed delivery and records the failure', async () => {
    const store = new MemoryWorkflowStore();
    const notifier = createNotifier();
    notifier.sendWorkflowNotification
      .mockResolvedValueOnce({ success: false, error: 'provider unavailable' })
      .mockResolvedValueOnce({ success: true, messageId: 'mail-2' });
    const workflow = new VestingReleaseNotificationWorkflow(
      store,
      notifier,
      async () => dueRelease,
      0
    );

    expect((await workflow.execute(employer, { grantId: 42 })).status).toBe('failed');
    expect((await workflow.execute(employer, { grantId: 42 })).output?.status).toBe('sent');
    expect(notifier.sendWorkflowNotification).toHaveBeenCalledTimes(2);
  });

  test('rejects early releases and non-employer actors', async () => {
    const store = new MemoryWorkflowStore();
    const notifier = createNotifier();
    const workflow = new VestingReleaseNotificationWorkflow(
      store,
      notifier,
      async () => ({ ...dueRelease, next_vesting_date: new Date(Date.now() + 86_400_000) }),
      0
    );

    expect((await workflow.execute(employee, { grantId: 42 })).error?.code).toBe('FORBIDDEN');
    const early = await workflow.execute(employer, { grantId: 42 });
    expect(early.status).toBe('failed');
    expect(early.steps.at(-1)).toMatchObject({ step: 'load-due-release', attempts: 3 });
    expect(notifier.sendWorkflowNotification).not.toHaveBeenCalled();
  });
});
