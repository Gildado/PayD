import { jest, describe, it, expect } from '@jest/globals';
import { SlowQueryOptimizationWorkflowService } from '../slowQueryOptimizationWorkflowService.js';
import type { SlowQueryMonitorService } from '../slowQueryMonitorService.js';

describe('SlowQueryOptimizationWorkflowService', () => {
  const stats = {
    totalQueries: 20,
    slowQueries: 2,
    slowQueryRate: '10.00%',
    threshold: '500ms',
  };

  function makeMonitor(): SlowQueryMonitorService {
    return { getStats: jest.fn().mockReturnValue(stats) } as unknown as SlowQueryMonitorService;
  }

  it('collects stats and generates recommendations on the happy path', async () => {
    const execute = jest.fn().mockResolvedValue({
      format: 'JSON',
      data: [{ recommendations: [{ message: 'Add an index' }] }],
    });
    const workflow = new SlowQueryOptimizationWorkflowService(makeMonitor(), { execute });

    const result = await workflow.runWorkflow({ requestId: 'workflow-happy', thresholdMs: 400 });

    expect(result.status).toBe('success');
    expect(result.executionId).toBe('workflow-happy');
    expect(result.steps.map((step) => step.step)).toEqual(['collectStats', 'generateRecommendations']);
    expect(result.stats).toEqual(stats);
    expect(execute).toHaveBeenCalledWith({ thresholdMs: 400, windowDays: undefined, limit: undefined });
  });

  it('retries a transient recommendation failure and records the retry', async () => {
    const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary database timeout'))
      .mockResolvedValueOnce({ format: 'JSON', data: [] });
    const workflow = new SlowQueryOptimizationWorkflowService(makeMonitor(), { execute });

    const result = await workflow.runWorkflow({ maxRetries: 1, retryDelayMs: 0 });

    expect(result.status).toBe('success');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.steps[1]).toMatchObject({
      step: 'generateRecommendations',
      status: 'retried',
      attempts: 2,
    });
  });

  it('returns a failed result after retries are exhausted', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const workflow = new SlowQueryOptimizationWorkflowService(makeMonitor(), { execute });

    const result = await workflow.runWorkflow({ maxRetries: 1, retryDelayMs: 0 });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Generate recommendations step failed');
    expect(result.steps[1]).toMatchObject({ status: 'failed', attempts: 2 });
  });
});
