import { z } from 'zod';
import { PayrollAuditService } from '../services/payrollAuditService.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowStore, type WorkflowRecord } from './store.js';

// A failed or disputed payroll run needs a recorded, replayable audit trail
// and a defined rollback path.
export const payrollAuditRollbackSchema = z
  .object({
    payrollRunId: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1000),
    targetStatus: z.string().trim().min(1).max(50).optional(),
    auditLogIds: z.array(z.number().int().positive()).max(500).optional(),
  })
  .strict();

export interface PayrollAuditRollbackInput extends z.infer<typeof payrollAuditRollbackSchema> {}

const KIND = 'payroll-audit-rollback' as const;
const STATUS_PENDING = 'pending_rollback';
const STATUS_ROLLING_BACK = 'rolling_back';
const STATUS_ROLLED_BACK = 'rolled_back';

function referenceFor(payrollRunId: number): string {
  return `payroll-rollback-${payrollRunId}`;
}

export class PayrollAuditRollbackWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly delayMs = 100
  ) {}

  async rollback(context: WorkflowContext, input: PayrollAuditRollbackInput) {
    const run = new WorkflowRun('payroll-audit-rollback', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = payrollAuditRollbackSchema.parse(input);
      const target = input.targetStatus ?? STATUS_ROLLED_BACK;

      const record = await run.step('stage-rollback', () =>
        this.store.create(organizationId, KIND, referenceFor(input.payrollRunId), STATUS_PENDING, {
          payrollRunId: input.payrollRunId,
          reason: input.reason,
          targetStatus: target,
          auditLogIds: input.auditLogIds ?? [],
          requestedBy: context.id,
          requestedAt: new Date().toISOString(),
        })
      );

      if (record.status === STATUS_ROLLED_BACK) return record;

      // Capture the current audit trail so the rollback is replayable even if a
      // later step fails. A read failure is retried (transient DB/HTTP errors only).
      const evidence = await run.step('capture-audit-trail', async () => {
        const { data } = await PayrollAuditService.getAuditLogs({
          organizationId,
          payrollRunId: input.payrollRunId,
        });
        return data.map((entry) => ({
          id: entry.id,
          action: entry.action,
          oldStatus: entry.old_status,
          newStatus: entry.new_status,
          createdAt: entry.created_at,
        }));
      });

      const claimed = await run.step(
        'claim-rollback',
        () =>
          this.store.transition(record, STATUS_ROLLING_BACK, {
            ...record.data,
            evidence,
            claimedBy: context.id,
            claimedAt: new Date().toISOString(),
          }),
        false
      );

      await run.step(
        'record-audit-entry',
        async () => {
          await PayrollAuditService.logRunStatusChanged(
            organizationId,
            input.payrollRunId,
            STATUS_ROLLING_BACK,
            target,
            { type: 'user', id: String(context.id) },
            { ipAddress: context.ip, userAgent: context.userAgent }
          );
        },
        false
      );

      return run.step(
        'finalize-rollback',
        () =>
          this.store.transition(claimed, STATUS_ROLLED_BACK, {
            ...claimed.data,
            completedBy: context.id,
            completedAt: new Date().toISOString(),
          }),
        false
      );
    });
  }

  async getRollback(context: WorkflowContext, payrollRunId: number) {
    const run = new WorkflowRun('payroll-audit-rollback-status', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      const record = await this.store.findByReference(
        organizationId,
        KIND,
        referenceFor(payrollRunId)
      );
      if (!record) throw new WorkflowError('NOT_FOUND', 'Rollback not found.', 404);
      return record;
    });
  }
}
