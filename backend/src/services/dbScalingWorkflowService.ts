import { DbScalingService } from './dbScalingService.js';
import { DbScalingPerformanceInsightAgent } from './dbScalingPerformanceInsightAgent.js';

export interface WorkflowOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  requestId?: string;
}

export interface WorkflowResult {
  status: 'success' | 'failed';
  steps: Array<{ step: string; status: 'success' | 'failed' | 'retried'; error?: string; durationMs: number }>;
  recommendations?: any;
  error?: string;
}

export class DbScalingWorkflowService {
  private dbScalingService: DbScalingService;
  private performanceAgent: DbScalingPerformanceInsightAgent;

  constructor(dbScalingService?: DbScalingService, performanceAgent?: DbScalingPerformanceInsightAgent) {
    this.dbScalingService = dbScalingService || new DbScalingService();
    this.performanceAgent = performanceAgent || new DbScalingPerformanceInsightAgent(this.dbScalingService);
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 100): Promise<T> {
    let attempts = 0;
    while (true) {
      try {
        return await fn();
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempts));
      }
    }
  }

  async runWorkflow(options: WorkflowOptions = {}): Promise<WorkflowResult> {
    const maxRetries = options.maxRetries ?? 3;
    const retryDelayMs = options.retryDelayMs ?? 50;
    const requestId = options.requestId || 'req-' + Math.random().toString(36).substring(2, 9);

    console.log(JSON.stringify({ level: 'info', message: 'Starting DB scaling recommendation workflow', requestId }));

    const steps: Array<{ step: string; status: 'success' | 'failed' | 'retried'; error?: string; durationMs: number }> = [];

    // Step 1: Health Check
    const startStep1 = Date.now();
    try {
      await this.executeWithRetry(() => this.dbScalingService.runHealthCheck(), maxRetries, retryDelayMs);
      steps.push({ step: 'healthCheck', status: 'success', durationMs: Date.now() - startStep1 });
      console.log(JSON.stringify({ level: 'info', message: 'Workflow step healthCheck succeeded', requestId }));
    } catch (err: any) {
      steps.push({ step: 'healthCheck', status: 'failed', error: err.message, durationMs: Date.now() - startStep1 });
      console.error(JSON.stringify({ level: 'error', message: 'Workflow step healthCheck failed', error: err.message, requestId }));
      return {
        status: 'failed',
        steps,
        error: `Health check step failed: ${err.message}`,
      };
    }

    // Step 2: Pool & Metrics Gathering
    const startStep2 = Date.now();
    try {
      await this.executeWithRetry(() => this.dbScalingService.getPoolStats(), maxRetries, retryDelayMs);
      steps.push({ step: 'gatherPoolStats', status: 'success', durationMs: Date.now() - startStep2 });
      console.log(JSON.stringify({ level: 'info', message: 'Workflow step gatherPoolStats succeeded', requestId }));
    } catch (err: any) {
      steps.push({ step: 'gatherPoolStats', status: 'failed', error: err.message, durationMs: Date.now() - startStep2 });
      console.error(JSON.stringify({ level: 'error', message: 'Workflow step gatherPoolStats failed', error: err.message, requestId }));
      return {
        status: 'failed',
        steps,
        error: `Gather pool stats step failed: ${err.message}`,
      };
    }

    // Step 3: Performance Insights & Recommendations Agent Execution
    const startStep3 = Date.now();
    try {
      const insightResult = await this.executeWithRetry(() => this.performanceAgent.execute({}), maxRetries, retryDelayMs);
      steps.push({ step: 'generateRecommendations', status: 'success', durationMs: Date.now() - startStep3 });
      console.log(JSON.stringify({ level: 'info', message: 'Workflow completed successfully', requestId }));
      return {
        status: 'success',
        steps,
        recommendations: insightResult,
      };
    } catch (err: any) {
      steps.push({ step: 'generateRecommendations', status: 'failed', error: err.message, durationMs: Date.now() - startStep3 });
      console.error(JSON.stringify({ level: 'error', message: 'Workflow step generateRecommendations failed', error: err.message, requestId }));
      return {
        status: 'failed',
        steps,
        error: `Generate recommendations step failed: ${err.message}`,
      };
    }
  }
}
