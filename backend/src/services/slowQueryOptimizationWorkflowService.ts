import logger from '../utils/logger.js';
import { pool } from '../config/database.js';
import { withSpan } from '../utils/tracing.js';
import { slowQueryMonitor, type SlowQueryMonitorService } from './slowQueryMonitorService.js';
import { SlowQueryTrendReportAgent } from './slowQueryTrendReportAgent.js';

export interface SlowQueryWorkflowOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  thresholdMs?: number;
  windowDays?: number;
  limit?: number;
  requestId?: string;
}

export interface SlowQueryWorkflowStep {
  step: 'collectStats' | 'generateRecommendations';
  status: 'success' | 'failed' | 'retried';
  attempts: number;
  durationMs: number;
  error?: string;
}

export interface SlowQueryWorkflowResult {
  status: 'success' | 'failed';
  executionId: string;
  steps: SlowQueryWorkflowStep[];
  stats?: ReturnType<SlowQueryMonitorService['getStats']>;
  report?: Awaited<ReturnType<SlowQueryTrendReportAgent['execute']>>;
  error?: string;
}

interface ReportAgent {
  execute(filters?: Record<string, unknown>): ReturnType<SlowQueryTrendReportAgent['execute']>;
}

export class SlowQueryOptimizationWorkflowService {
  constructor(
    private readonly monitor: SlowQueryMonitorService = slowQueryMonitor,
    private readonly reportAgent: ReportAgent = new SlowQueryTrendReportAgent(
      pool
    ),
  ) {}

  async runWorkflow(options: SlowQueryWorkflowOptions = {}): Promise<SlowQueryWorkflowResult> {
    const executionId = options.requestId ?? crypto.randomUUID();
    const maxRetries = Math.max(0, options.maxRetries ?? 2);
    const retryDelayMs = Math.max(0, options.retryDelayMs ?? 100);
    const steps: SlowQueryWorkflowStep[] = [];

    logger.info('Starting slow-query optimization workflow', {
      executionId,
      thresholdMs: options.thresholdMs,
      windowDays: options.windowDays,
    });

    return withSpan(
      'slow-query.optimization-workflow',
      { 'workflow.execution_id': executionId },
      async (): Promise<SlowQueryWorkflowResult> => {
        const statsStep = await this.runStep(
          'collectStats',
          () => Promise.resolve(this.monitor.getStats()),
          maxRetries,
          retryDelayMs,
          executionId,
          steps,
        );
        if (!statsStep.value) {
          return this.failure(executionId, steps, 'Collect stats step failed');
        }

        const reportStep = await this.runStep(
          'generateRecommendations',
          () =>
            this.reportAgent.execute({
              thresholdMs: options.thresholdMs,
              windowDays: options.windowDays,
              limit: options.limit,
            }),
          maxRetries,
          retryDelayMs,
          executionId,
          steps,
        );
        if (!reportStep.value) {
          return this.failure(executionId, steps, 'Generate recommendations step failed', statsStep.value);
        }

        logger.info('Completed slow-query optimization workflow', {
          executionId,
          steps: steps.length,
          recommendationCount: reportStep.value.data?.[0]
            ? (reportStep.value.data[0] as { recommendations?: unknown[] }).recommendations?.length ?? 0
            : 0,
        });
        return {
          status: 'success',
          executionId,
          steps,
          stats: statsStep.value,
          report: reportStep.value,
        };
      },
    ).catch((error: unknown) => {
      logger.error('Slow-query optimization workflow failed unexpectedly', {
        executionId,
        error,
      });
      return this.failure(executionId, steps, error instanceof Error ? error.message : String(error));
    });
  }

  private async runStep<T>(
    step: SlowQueryWorkflowStep['step'],
    operation: () => Promise<T>,
    maxRetries: number,
    retryDelayMs: number,
    executionId: string,
    steps: SlowQueryWorkflowStep[],
  ): Promise<{ value?: T }> {
    const startedAt = Date.now();
    let attempts = 0;
    let lastError: unknown;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        const value = await withSpan(
          `slow-query.${step}`,
          { 'workflow.execution_id': executionId, 'workflow.attempt': attempts },
          operation,
        );
        steps.push({
          step,
          status: attempts > 1 ? 'retried' : 'success',
          attempts,
          durationMs: Date.now() - startedAt,
        });
        return { value };
      } catch (error: unknown) {
        lastError = error;
        if (attempts <= maxRetries) {
          const delay = retryDelayMs * 2 ** (attempts - 1);
          logger.warn('Retrying slow-query workflow step', {
            executionId,
            step,
            attempt: attempts,
            nextAttempt: attempts + 1,
            delayMs: delay,
            error,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    steps.push({ step, status: 'failed', attempts, durationMs: Date.now() - startedAt, error: errorMessage });
    logger.error('Slow-query workflow step failed', { executionId, step, attempts, error: errorMessage });
    return {};
  }

  private failure(
    executionId: string,
    steps: SlowQueryWorkflowStep[],
    error: string,
    stats?: ReturnType<SlowQueryMonitorService['getStats']>,
  ): SlowQueryWorkflowResult {
    return { status: 'failed', executionId, steps, stats, error };
  }
}
