import { randomUUID } from 'node:crypto';
import logger from '../utils/logger.js';
import { withSpan } from '../utils/tracing.js';
import type { JWTPayload } from '../types/auth.js';
import { z } from 'zod';

export type WorkflowContext = JWTPayload;

export class WorkflowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400
  ) {
    super(message);
  }
}

export class NotReadyError extends Error {}

export function requireOrganization(context: WorkflowContext, employerOnly = false): number {
  if (!context.organizationId || (employerOnly && context.role !== 'EMPLOYER')) {
    throw new WorkflowError('FORBIDDEN', 'Organization access is required.', 403);
  }
  return context.organizationId;
}

export interface WorkflowStep {
  step: string;
  attempts: number;
  status: 'completed' | 'failed';
  durationMs: number;
}

export interface WorkflowResult<T> {
  executionId: string;
  status: 'completed' | 'failed';
  steps: WorkflowStep[];
  output?: T;
  error?: { code: string; message: string };
}

function isTransient(error: unknown): boolean {
  if (error instanceof NotReadyError) return true;
  const e = error as { response?: { status?: number }; code?: string } | undefined;
  const status = e?.response?.status;
  return (
    status === 429 ||
    (status !== undefined && status >= 500) ||
    [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EAI_AGAIN',
      '40001',
      '40P01',
      '08006',
      '57P01',
    ].includes(e?.code ?? '')
  );
}

/** A new instance belongs to one execution. Never retry the whole workflow. */
export class WorkflowRun {
  readonly executionId = randomUUID();
  readonly steps: WorkflowStep[] = [];

  constructor(
    private readonly name: string,
    private readonly context: WorkflowContext,
    private readonly retryDelayMs = 100
  ) {}

  async step<T>(step: string, operation: () => Promise<T>, retrySafe = true): Promise<T> {
    const startedAt = Date.now();
    const meta = {
      executionId: this.executionId,
      workflow: this.name,
      step,
      organizationId: this.context.organizationId,
      actorId: this.context.id,
    };
    for (let attempt = 1; ; attempt++) {
      logger.info('Workflow step started', { ...meta, attempt });
      try {
        const value = await withSpan(
          `workflow.${this.name}.${step}`,
          {
            'workflow.execution_id': this.executionId,
            'workflow.attempt': attempt,
            'organization.id': this.context.organizationId ?? 0,
          },
          operation
        );
        this.steps.push({
          step,
          attempts: attempt,
          status: 'completed',
          durationMs: Date.now() - startedAt,
        });
        logger.info('Workflow step completed', { ...meta, attempt });
        return value;
      } catch (error) {
        if (retrySafe && attempt < 3 && isTransient(error)) {
          logger.warn('Workflow step retry scheduled', { ...meta, attempt });
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * 2 ** (attempt - 1))
          );
          continue;
        }
        this.steps.push({
          step,
          attempts: attempt,
          status: 'failed',
          durationMs: Date.now() - startedAt,
        });
        // Do not log request bodies, secrets, signed envelopes, or raw upstream errors.
        logger.error('Workflow step failed', { ...meta, attempt });
        throw error;
      }
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<WorkflowResult<T>> {
    logger.info('Workflow started', { workflow: this.name, executionId: this.executionId });
    try {
      const output = await withSpan(
        `workflow.${this.name}`,
        {
          'workflow.execution_id': this.executionId,
        },
        operation
      );
      logger.info('Workflow completed', { workflow: this.name, executionId: this.executionId });
      return { executionId: this.executionId, status: 'completed', steps: this.steps, output };
    } catch (error) {
      const known = error instanceof WorkflowError;
      const invalid = error instanceof z.ZodError;
      logger.error('Workflow failed', { workflow: this.name, executionId: this.executionId });
      return {
        executionId: this.executionId,
        status: 'failed',
        steps: this.steps,
        error: {
          code: known ? error.code : invalid ? 'INVALID_INPUT' : 'STEP_FAILED',
          message: known
            ? error.message
            : invalid
              ? 'Invalid workflow input.'
              : 'Workflow step failed. Retry using the same resource identifier.',
        },
      };
    }
  }
}
