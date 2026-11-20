/**
 * Startup hook for durable workflow recovery.
 *
 * Called once from index.ts after configuration is loaded. It never throws:
 * a failed scan must not prevent the API from starting.
 */
import logger from '../utils/logger.js';
import {
  recoverInFlightWorkflows,
  workflowRecoveryRegistry,
  type RecoveryReport,
  type WorkflowRecoveryHandler,
  type ResumeAction,
} from './recovery.js';
import { PostgresWorkflowStore } from './store.js';

/**
 * Built-in handlers. Only workflows whose continuation is provably safe are
 * registered here; everything else is left to its domain-specific resume path.
 */
export function registerBuiltInRecoveryHandlers(
  registry = workflowRecoveryRegistry
): void {
  const notificationDelivery: WorkflowRecoveryHandler = {
    kind: 'workflow-notification-delivery',
    async resume(record): Promise<ResumeAction> {
      const messageId = record.data.messageId;
      // A persisted provider message ID means delivery succeeded and only the
      // final status write was lost. Completing it never re-sends an email.
      if (typeof messageId === 'string' && messageId.length > 0) {
        return { action: 'resume', status: 'sent', data: { messageId } };
      }
      // Without proof of delivery we must not resend or guess the outcome.
      return { action: 'skip', reason: 'delivery_outcome_unknown' };
    },
  };
  registry.register(notificationDelivery);
}

/** Maximum time the boot scan may delay startup. */
export const BOOT_RECOVERY_TIMEOUT_MS = 5000;

export async function recoverInFlightWorkflowsOnBoot(
  store = new PostgresWorkflowStore(),
  registry = workflowRecoveryRegistry,
  timeoutMs = BOOT_RECOVERY_TIMEOUT_MS
): Promise<RecoveryReport | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Boot workflow recovery timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    registerBuiltInRecoveryHandlers(registry);
    const report = await Promise.race([recoverInFlightWorkflows(store, registry), deadline]);
    logger.info('Boot workflow recovery complete', {
      scanned: report.scanned,
      resumed: report.resumed.length,
      skipped: report.skipped.length,
      retried: report.retried.length,
      quarantined: report.quarantined.length,
      conflicts: report.conflicts,
      failures: report.failures,
    });
    return report;
  } catch (error) {
    // Never block startup on a recovery failure; the scan can be retried.
    logger.error('Boot workflow recovery failed; continuing startup', error);
    return null;
  } finally {
    clearTimeout(timer!);
  }
}
