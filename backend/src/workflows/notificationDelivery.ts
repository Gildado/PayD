import type { WorkflowNotificationOptions } from '../services/notificationService.js';
import { WorkflowError, type WorkflowRun } from './runtime.js';
import type { WorkflowStore } from './store.js';

export interface WorkflowNotificationSender {
  sendWorkflowNotification(options: WorkflowNotificationOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export async function sendWorkflowNotificationOnce(
  run: WorkflowRun,
  store: WorkflowStore,
  sender: WorkflowNotificationSender,
  options: WorkflowNotificationOptions
): Promise<'sent' | 'skipped' | 'pending'> {
  const record = await run.step('claim-notification-delivery', () =>
    store.create(
      options.organizationId,
      'workflow-notification-delivery',
      `${options.eventKey}:${options.employeeId}`,
      'pending',
      { employeeId: options.employeeId }
    )
  );

  if (record.status === 'sent' || record.status === 'skipped') return record.status;
  if (record.status === 'sending') return 'pending';

  const sending = await run.step(
    'mark-notification-delivery-sending',
    () => store.transition(record, 'sending'),
    false
  );
  let result: Awaited<ReturnType<WorkflowNotificationSender['sendWorkflowNotification']>>;
  try {
    result = await run.step(
      'send-workflow-notification',
      () => sender.sendWorkflowNotification(options),
      false
    );
  } catch (error) {
    // A lost provider response is ambiguous; leave the record sending to avoid duplicate emails.
    throw error;
  }

  if (!result.success) {
    await run.step(
      'record-notification-delivery-failure',
      () =>
        store.transition(sending, 'failed', {
          ...sending.data,
          error: result.error,
        }),
      false
    );
    throw new WorkflowError(
      'NOTIFICATION_FAILED',
      'Workflow notification could not be delivered.',
      503
    );
  }

  await run.step(
    'record-notification-delivery',
    () =>
      store.transition(sending, result.messageId === 'skipped' ? 'skipped' : 'sent', {
        ...sending.data,
      }),
    false
  );
  return result.messageId === 'skipped' ? 'skipped' : 'sent';
}
