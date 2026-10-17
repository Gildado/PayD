import { z } from 'zod';
import { pool } from '../config/database.js';
import {
  NotificationService,
  type WorkflowNotificationOptions,
} from '../services/notificationService.js';
import {
  NotReadyError,
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowRecord, type WorkflowStore } from './store.js';
import { sendWorkflowNotificationOnce } from './notificationDelivery.js';

export const vestingReleaseSchema = z.object({ grantId: z.number().int().positive() }).strict();

export interface VestingRelease {
  id: number;
  organization_id: number;
  employee_id: number;
  next_vesting_date: Date | string;
  next_vesting_amount: string | number;
}

export interface WorkflowNotifier {
  sendWorkflowNotification(options: WorkflowNotificationOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

async function loadVestingRelease(
  organizationId: number,
  grantId: number
): Promise<VestingRelease | null> {
  const result = await pool.query<VestingRelease>(
    `SELECT id, organization_id, employee_id, next_vesting_date, next_vesting_amount
     FROM vesting_grants
     WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
    [grantId, organizationId]
  );
  return result.rows[0] ?? null;
}

export class VestingReleaseNotificationWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly notifier: WorkflowNotifier = new NotificationService(),
    private readonly loadRelease = loadVestingRelease,
    private readonly delayMs = 100
  ) {}

  async execute(context: WorkflowContext, input: z.infer<typeof vestingReleaseSchema>) {
    const run = new WorkflowRun('vesting-release-notification', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = vestingReleaseSchema.parse(input);

      const release = await run.step('load-due-release', async () => {
        const grant = await this.loadRelease(organizationId, input.grantId);
        if (!grant) throw new WorkflowError('NOT_FOUND', 'Active vesting grant not found.', 404);
        if (grant.organization_id !== organizationId) {
          throw new WorkflowError('NOT_FOUND', 'Active vesting grant not found.', 404);
        }
        const releaseDate = new Date(grant.next_vesting_date);
        if (!Number.isFinite(releaseDate.getTime())) {
          throw new WorkflowError('INVALID_RELEASE', 'Vesting grant has an invalid release date.');
        }
        if (releaseDate.getTime() > Date.now()) {
          throw new NotReadyError('The next vesting tranche is not yet releasable.');
        }
        const amount = Number(grant.next_vesting_amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new WorkflowError('INVALID_RELEASE', 'Vesting grant has no releasable amount.');
        }
        return { grant, releaseDate, amount };
      });

      const reference = `grant:${release.grant.id}:${release.releaseDate.toISOString()}`;
      let record = await run.step('claim-notification', () =>
        this.store.create(organizationId, 'vesting-release-notification', reference, 'pending', {
          grantId: release.grant.id,
          employeeId: release.grant.employee_id,
          releaseDate: release.releaseDate.toISOString(),
          amount: String(release.amount),
        })
      );

      if (record.status === 'sent' || record.status === 'skipped') {
        return { status: record.status, notificationId: record.id };
      }
      if (record.status === 'sending')
        return { status: 'pending' as const, notificationId: record.id };
      if (record.status !== 'notifying') {
        record = await run.step(
          'mark-notification-started',
          () => this.store.transition(record, 'notifying'),
          false
        );
      }
      const deliveryStatus = await sendWorkflowNotificationOnce(run, this.store, this.notifier, {
        organizationId,
        employeeId: release.grant.employee_id,
        eventKey: reference,
        title: 'Vesting tranche is releasable',
        message: `A vesting tranche of ${release.amount} is available from ${release.releaseDate.toISOString().slice(0, 10)}.`,
      });
      if (deliveryStatus === 'pending') {
        return { status: 'pending' as const, notificationId: record.id };
      }

      record = await run.step(
        'record-notification-result',
        () => this.store.transition(record, deliveryStatus),
        false
      );
      return { status: record.status, notificationId: record.id };
    });
  }
}

export function publicVestingNotification(record: WorkflowRecord): WorkflowRecord {
  const data = { ...record.data };
  delete data.messageId;
  return { ...record, data };
}
