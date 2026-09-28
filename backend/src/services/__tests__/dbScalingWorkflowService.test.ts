import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DbScalingWorkflowService } from '../dbScalingWorkflowService.js';
import type { DbScalingService } from '../dbScalingService.js';
import type { DbScalingPerformanceInsightAgent } from '../dbScalingPerformanceInsightAgent.js';

describe('DbScalingWorkflowService', () => {
  let mockDbService: jest.Mocked<DbScalingService>;
  let mockAgent: jest.Mocked<DbScalingPerformanceInsightAgent>;
  let workflowService: DbScalingWorkflowService;

  beforeEach(() => {
    mockDbService = {
      runHealthCheck: jest.fn().mockResolvedValue({ ok: true, latencyMs: 50 }),
      getPoolStats: jest.fn().mockResolvedValue({
        activeConnections: 5,
        idleConnections: 5,
        waitingRequests: 0,
        maxConnections: 10,
      }),
    } as unknown as jest.Mocked<DbScalingService>;

    mockAgent = {
      execute: jest.fn().mockResolvedValue({
        format: 'JSON',
        data: [{ summary: { healthy: true }, recommendations: ['Scale up connection pool'] }],
      }),
    } as unknown as jest.Mocked<DbScalingPerformanceInsightAgent>;

    workflowService = new DbScalingWorkflowService(mockDbService, mockAgent);
  });

  describe('happy path', () => {
    it('completes all workflow steps successfully', async () => {
      const result = await workflowService.runWorkflow({ requestId: 'test-req-1' });

      expect(result.status).toBe('success');
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].step).toBe('healthCheck');
      expect(result.steps[0].status).toBe('success');
      expect(result.steps[1].step).toBe('gatherPoolStats');
      expect(result.steps[1].status).toBe('success');
      expect(result.steps[2].step).toBe('generateRecommendations');
      expect(result.steps[2].status).toBe('success');
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('failure path and retry handling', () => {
    it('retries on failure and eventually succeeds if transient', async () => {
      let attempts = 0;
      mockDbService.runHealthCheck = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary connection glitch');
        }
        return { ok: true, latencyMs: 30 };
      });

      const result = await workflowService.runWorkflow({ maxRetries: 3, retryDelayMs: 10, requestId: 'test-req-retry' });

      expect(result.status).toBe('success');
      expect(attempts).toBe(3);
    });

    it('fails workflow when retries are exhausted', async () => {
      mockDbService.runHealthCheck = jest.fn().mockRejectedValue(new Error('Fatal DB failure'));

      const result = await workflowService.runWorkflow({ maxRetries: 2, retryDelayMs: 10, requestId: 'test-req-fail' });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Health check step failed');
      expect(result.steps[0].status).toBe('failed');
    });
  });
});
