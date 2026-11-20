/**
 * Webhook Delivery Health Report Agent Tests
 *
 * Tests the webhook delivery health report agent with fixture dataset.
 * Verifies that the report correctly calculates success rates, identifies
 * failure patterns, and provides useful breakdowns by event type and subscription.
 */

import { WebhookDeliveryHealthReportAgent } from '../services/webhookDeliveryHealthReportAgent.js';
import type { Pool, PoolClient } from 'pg';

// Mock the pg module
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

describe('WebhookDeliveryHealthReportAgent', () => {
  let agent: WebhookDeliveryHealthReportAgent;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { Pool } = require('pg');
    mockPool = new Pool();
    agent = new WebhookDeliveryHealthReportAgent(mockPool);
  });

  describe('execute', () => {
    it('should require organizationId', async () => {
      await expect(agent.execute({})).rejects.toThrow('organizationId is required');
      await expect(agent.execute({ organizationId: 0 })).rejects.toThrow('organizationId is required');
    });

    it('should generate report with default time period', async () => {
      // Mock empty results for default time period
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await agent.execute({ organizationId: 1 });

      expect(result.executionId).toBeDefined();
      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);
      expect(result.summary.totalRecords).toBe(0);
      expect(result.summary.processedRecords).toBe(0);
      expect(result.summary.failedRecords).toBe(0);
    });

    it('should handle successful webhook deliveries', async () => {
      // Mock summary query
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_deliveries: 100,
          successful_deliveries: 95,
          failed_deliveries: 5,
          avg_attempts: 1.2,
        }],
      });

      // Mock event type breakdown
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          event_type: 'payroll.completed',
          total: 60,
          successful: 58,
          failed: 2,
          avg_attempts: 1.1,
        }, {
          event_type: 'employee.added',
          total: 40,
          successful: 37,
          failed: 3,
          avg_attempts: 1.3,
        }],
      });

      // Mock subscription breakdown
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          subscription_id: 'sub-001',
          url: 'https://webhook.example.com/endpoint1',
          total: 70,
          successful: 67,
          failed: 3,
          avg_attempts: 1.15,
          last_delivery: new Date('2024-01-15T12:00:00Z'),
        }, {
          subscription_id: 'sub-002',
          url: 'https://webhook.example.com/endpoint2',
          total: 30,
          successful: 28,
          failed: 2,
          avg_attempts: 1.25,
          last_delivery: new Date('2024-01-14T10:30:00Z'),
        }],
      });

      // Mock failure patterns (empty - no failures)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock recent failures (empty - no failures)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock historical trends
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          date: new Date('2024-01-15'),
          total: 20,
          successful: 19,
          failed: 1,
        }, {
          date: new Date('2024-01-14'),
          total: 25,
          successful: 24,
          failed: 1,
        }],
      });

      const result = await agent.execute({ organizationId: 1, startDate: '2024-01-14', endDate: '2024-01-15' });
      const report = result.data[0];

      // Verify summary
      expect(report.summary.totalDeliveries).toBe(100);
      expect(report.summary.successfulDeliveries).toBe(95);
      expect(report.summary.failedDeliveries).toBe(5);
      expect(report.summary.successRate).toBe(95);
      expect(report.summary.failureRate).toBe(5);
      expect(report.summary.avgAttempts).toBe(1.2);
      expect(report.summary.timePeriod.start).toBe('2024-01-14');
      expect(report.summary.timePeriod.end).toBe('2024-01-15');

      // Verify event type breakdown
      expect(report.byEventType).toHaveLength(2);
      expect(report.byEventType[0].eventType).toBe('payroll.completed');
      expect(report.byEventType[0].successRate).toBe(96.67);
      expect(report.byEventType[1].eventType).toBe('employee.added');
      expect(report.byEventType[1].successRate).toBe(92.5);

      // Verify subscription breakdown
      expect(report.bySubscription).toHaveLength(2);
      expect(report.bySubscription[0].subscriptionId).toBe('sub-001');
      expect(report.bySubscription[0].successRate).toBe(95.71);
      expect(report.bySubscription[1].subscriptionId).toBe('sub-002');
      expect(report.bySubscription[1].successRate).toBe(93.33);

      // Verify empty failure patterns and recent failures
      expect(report.failurePatterns).toHaveLength(0);
      expect(report.recentFailures).toHaveLength(0);

      // Verify historical trends
      expect(report.historicalTrends).toHaveLength(2);
      expect(report.historicalTrends[0].date).toBe('2024-01-15');
      expect(report.historicalTrends[0].successRate).toBe(95);
      expect(report.historicalTrends[1].date).toBe('2024-01-14');
      expect(report.historicalTrends[1].successRate).toBe(96);
    });

    it('should identify failure patterns and recent failures', async () => {
      // Mock summary query
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          total_deliveries: 50,
          successful_deliveries: 35,
          failed_deliveries: 15,
          avg_attempts: 2.5,
        }],
      });

      // Mock event type breakdown
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock subscription breakdown
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock failure patterns
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          error_message: 'Connection timeout',
          count: 8,
          percentage: 53.33,
          example_subscription_id: 'sub-001',
          example_event_type: 'payroll.completed',
          last_occurred: new Date('2024-01-15T14:30:00Z'),
        }, {
          error_message: 'SSL certificate expired',
          count: 5,
          percentage: 33.33,
          example_subscription_id: 'sub-002',
          example_event_type: 'employee.added',
          last_occurred: new Date('2024-01-14T11:15:00Z'),
        }],
      });

      // Mock recent failures
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 101,
          subscription_id: 'sub-001',
          event_type: 'payroll.completed',
          error_message: 'Connection timeout',
          attempt_number: 3,
          delivered_at: new Date('2024-01-15T14:30:00Z'),
        }, {
          id: 102,
          subscription_id: 'sub-002',
          event_type: 'employee.added',
          error_message: 'SSL certificate expired',
          attempt_number: 2,
          delivered_at: new Date('2024-01-14T11:15:00Z'),
        }],
      });

      // Mock historical trends
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await agent.execute({ organizationId: 1, startDate: '2024-01-14', endDate: '2024-01-15' });
      const report = result.data[0];

      // Verify summary with high failure rate
      expect(report.summary.totalDeliveries).toBe(50);
      expect(report.summary.successfulDeliveries).toBe(35);
      expect(report.summary.failedDeliveries).toBe(15);
      expect(report.summary.successRate).toBe(70);
      expect(report.summary.failureRate).toBe(30);
      expect(report.summary.avgAttempts).toBe(2.5);

      // Verify failure patterns
      expect(report.failurePatterns).toHaveLength(2);
      expect(report.failurePatterns[0].errorMessage).toBe('Connection timeout');
      expect(report.failurePatterns[0].count).toBe(8);
      expect(report.failurePatterns[0].percentage).toBe(53.33);
      expect(report.failurePatterns[1].errorMessage).toBe('SSL certificate expired');
      expect(report.failurePatterns[1].count).toBe(5);
      expect(report.failurePatterns[1].percentage).toBe(33.33);

      // Verify recent failures
      expect(report.recentFailures).toHaveLength(2);
      expect(report.recentFailures[0].id).toBe(101);
      expect(report.recentFailures[0].subscriptionId).toBe('sub-001');
      expect(report.recentFailures[0].errorMessage).toBe('Connection timeout');
      expect(report.recentFailures[0].attemptNumber).toBe(3);
      expect(report.recentFailures[1].id).toBe(102);
      expect(report.recentFailures[1].subscriptionId).toBe('sub-002');
      expect(report.recentFailures[1].errorMessage).toBe('SSL certificate expired');
      expect(report.recentFailures[1].attemptNumber).toBe(2);
    });

    it('should handle edge cases with no data', async () => {
      // Mock all queries to return empty results
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await agent.execute({ organizationId: 1 });
      const report = result.data[0];

      expect(report.summary.totalDeliveries).toBe(0);
      expect(report.summary.successfulDeliveries).toBe(0);
      expect(report.summary.failedDeliveries).toBe(0);
      expect(report.summary.successRate).toBe(0);
      expect(report.summary.failureRate).toBe(0);
      expect(report.summary.avgAttempts).toBe(0);
      expect(report.byEventType).toHaveLength(0);
      expect(report.bySubscription).toHaveLength(0);
      expect(report.failurePatterns).toHaveLength(0);
      expect(report.recentFailures).toHaveLength(0);
      expect(report.historicalTrends).toHaveLength(0);
    });

    it('should respect limit parameter for recent failures', async () => {
      // Mock summary and other queries
      mockPool.query.mockResolvedValueOnce({ rows: [{ total_deliveries: 10, successful_deliveries: 8, failed_deliveries: 2, avg_attempts: 1.5 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock recent failures query - should respect limit
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, subscription_id: 'sub-001', event_type: 'payroll.completed', error_message: 'Error 1', attempt_number: 1, delivered_at: new Date() },
          { id: 2, subscription_id: 'sub-002', event_type: 'employee.added', error_message: 'Error 2', attempt_number: 2, delivered_at: new Date() },
        ],
      });

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await agent.execute({ organizationId: 1, limit: 5 });
      
      // Verify the query was called with limit parameter
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $'),
        expect.arrayContaining([expect.any(String), expect.any(String), expect.any(String), 5])
      );
    });
  });

  describe('validate', () => {
    it('should always return valid safety validation', async () => {
      const validation = await agent.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.piiDetected).toHaveLength(0);
    });
  });

  describe('agent properties', () => {
    it('should have correct id, name, and description', () => {
      expect(agent.id).toBe('webhook-delivery-health');
      expect(agent.name).toBe('Webhook Delivery Health Report');
      expect(agent.description).toBe('Reports on webhook delivery success rates and recurring failure patterns');
    });
  });
});