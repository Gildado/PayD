import { z } from 'zod';
import { PayrollAuditService } from '../services/payrollAuditService.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowStore, type WorkflowRecord } from './store.js';

// Payroll execution needs an explicit approval checkpoint before funds move.
export const payrollApprovalSchema = z
  .object({
    payrollRunId: z.number().int().positive(),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export interface PayrollApprovalInput extends z.infer<typeof payrollApprovalSchema> {}

const KIND = 'payroll-approval' as const;
const STATUS_PENDING = 'pending_approval';
const STATUS_APPROVED = 'approved';
const STATUS_REJECTED = 'rejected';

function referenceFor(payrollRunId: number): string {
  return `payroll-run-${payrollRunId}`;
}

export class PayrollApprovalWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly delayMs = 100
  ) {}

  private async stage(
    context: WorkflowContext,
    organizationId: number,
    payrollRunId: number
  ): Promise<WorkflowRecord> {
    return this.store.create(organizationId, KIND, referenceFor(payrollRunId), STATUS_PENDING, {
      payrollRunId,
      requestedBy: context.id,
      requestedAt: new Date().toISOString(),
    });
  }

  private async load(
    context: WorkflowContext,
    organizationId: number,
    payrollRunId: number
  ): Promise<WorkflowRecord> {
    const record = await this.store.findByReference(
      organizationId,
      KIND,
      referenceFor(payrollRunId)
    );
    if (!record) {
      throw new WorkflowError('NOT_FOUND', 'Payroll approval not found.', 404);
    }
    return record;
  }

  async requestApproval(context: WorkflowContext, payrollRunId: number) {
    const run = new WorkflowRun('payroll-approval-request', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      const record = await run.step('stage-approval', () =>
        this.stage(context, organizationId, payrollRunId)
      );
      await run.step(
        'audit-request',
        async () => {
          await PayrollAuditService.logRunStatusChanged(
            organizationId,
            payrollRunId,
            'draft',
            STATUS_PENDING,
            { type: 'user', id: String(context.id) },
            { ipAddress: context.ip, userAgent: context.userAgent }
          );
        },
        false
      );
      return record;
    });
  }

  async review(context: WorkflowContext, input: PayrollApprovalInput) {
    const run = new WorkflowRun(`payroll-approval-${input.decision}`, context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = payrollApprovalSchema.parse(input);
      const record = await run.step('load-or-stage-approval', async () => {
        const existing = await this.store.findByReference(
          organizationId,
          KIND,
          referenceFor(input.payrollRunId)
        );
        return existing ?? this.stage(context, organizationId, input.payrollRunId);
      });

      // Terminal decisions are idempotent: replaying a review never reopens one.
      if (record.status === STATUS_APPROVED || record.status === STATUS_REJECTED) {
        return record;
      }

      const target = input.decision === 'approve' ? STATUS_APPROVED : STATUS_REJECTED;
      // Conditional claim prevents a concurrent approval and rejection from both winning.
      const claimed = await run.step(
        'claim-review',
        () =>
          this.store.transition(record, target, {
            ...record.data,
            reviewedBy: context.id,
            reviewReason: input.reason,
            reviewedAt: new Date().toISOString(),
          }),
        false
      );

      await run.step(
        'audit-review',
        async () => {
          await PayrollAuditService.logRunStatusChanged(
            organizationId,
            input.payrollRunId,
            STATUS_PENDING,
            target,
            { type: 'user', id: String(context.id) },
            { ipAddress: context.ip, userAgent: context.userAgent }
          );
        },
        false
      );

      return claimed;
    });
  }

  async getApproval(context: WorkflowContext, payrollRunId: number) {
    const run = new WorkflowRun('payroll-approval-status', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      return this.load(context, organizationId, payrollRunId);
    });
  }
}
