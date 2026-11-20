import { z } from 'zod';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';
import { PostgresWorkflowStore, type WorkflowStore, type WorkflowRecord } from './store.js';

// The BulkPaymentStatusTracker UI polls state. This workflow gives it a single
// durable, event-driven source of truth for batch progress instead.
export const bulkPaymentStatusSchema = z
  .object({
    batchId: z.string().trim().min(1).max(255),
    status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    completedCount: z.number().int().min(0).optional(),
    totalItems: z.number().int().min(0).optional(),
    lastTxHash: z.string().trim().max(255).optional(),
  })
  .strict();

export interface BulkPaymentStatusInput extends z.infer<typeof bulkPaymentStatusSchema> {}

const KIND = 'bulk-payment-status' as const;

function referenceFor(batchId: string): string {
  return `bulk-payment-${batchId}`;
}

export class BulkPaymentStatusWorkflow {
  constructor(
    private readonly store: WorkflowStore = new PostgresWorkflowStore(),
    private readonly delayMs = 100
  ) {}

  async track(context: WorkflowContext, input: BulkPaymentStatusInput) {
    const run = new WorkflowRun('bulk-payment-status-track', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      input = bulkPaymentStatusSchema.parse(input);

      const record = await run.step('load-or-stage-tracking', async () => {
        const existing = await this.store.findByReference(
          organizationId,
          KIND,
          referenceFor(input.batchId)
        );
        return (
          existing ??
          this.store.create(organizationId, KIND, referenceFor(input.batchId), 'tracking', {
            batchId: input.batchId,
            organizationId,
            status: 'pending',
            progress: 0,
            completedCount: 0,
            totalItems: 0,
            createdAt: new Date().toISOString(),
          })
        );
      });

      // Completed batches are terminal: a late socket event must not reopen them.
      if (record.status === 'completed') return record;

      const merged = {
        ...record.data,
        status: input.status ?? record.data.status ?? 'pending',
        progress: input.progress ?? Number(record.data.progress ?? 0),
        completedCount: input.completedCount ?? Number(record.data.completedCount ?? 0),
        totalItems: input.totalItems ?? Number(record.data.totalItems ?? 0),
        lastTxHash: input.lastTxHash ?? record.data.lastTxHash ?? null,
        updatedBy: context.id,
        updatedAt: new Date().toISOString(),
      };

      return run.step('persist-progress', () =>
        this.store.transition(record, 'tracking', merged)
      );
    });
  }

  async complete(context: WorkflowContext, batchId: string) {
    const run = new WorkflowRun('bulk-payment-status-complete', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      const record = await run.step('load-tracking', () => this.load(organizationId, batchId));
      if (record.status === 'completed') return record;

      const totalItems = Number(record.data.totalItems ?? record.data.completedCount ?? 0);
      return run.step(
        'mark-completed',
        () =>
          this.store.transition(record, 'completed', {
            ...record.data,
            status: 'completed',
            progress: 100,
            completedCount: totalItems,
            completedBy: context.id,
            completedAt: new Date().toISOString(),
          }),
        false
      );
    });
  }

  async getStatus(context: WorkflowContext, batchId: string) {
    const run = new WorkflowRun('bulk-payment-status-read', context, this.delayMs);
    return run.execute(async () => {
      const organizationId = requireOrganization(context, true);
      return this.load(organizationId, batchId);
    });
  }

  private async load(organizationId: number, batchId: string): Promise<WorkflowRecord> {
    const record = await this.store.findByReference(
      organizationId,
      KIND,
      referenceFor(batchId)
    );
    if (!record) throw new WorkflowError('NOT_FOUND', 'Bulk payment batch not found.', 404);
    return record;
  }
}
