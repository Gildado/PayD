/**
 * Tests for ScheduledReportDeliveryAgent
 */

import { describe, it, expect } from '@jest/globals';
import { ScheduledReportDeliveryAgent } from '../scheduledReportDeliveryAgent.js';

describe('ScheduledReportDeliveryAgent', () => {
  describe('execute()', () => {
    it('returns a valid ReportResult with empty data when no jobs exist', async () => {
      const agent = new ScheduledReportDeliveryAgent();
      const result = await agent.execute();

      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);
      expect(result.metadata.schema).toBe('scheduled-report-delivery');

      const report = result.data![0] as any;
      expect(report.summary.totalJobs).toBe(0);
      expect(report.summary.completedJobs).toBe(0);
      expect(report.summary.failedJobs).toBe(0);
      expect(report.summary.processingJobs).toBe(0);
      expect(report.summary.pendingJobs).toBe(0);
      expect(report.summary.successRate).toBe(0);
      expect(report.byFormat).toHaveLength(0);
      expect(report.recentJobs).toHaveLength(0);
    });

    it('returns valid schema structure', async () => {
      const agent = new ScheduledReportDeliveryAgent();
      const result = await agent.execute();

      const report = result.data![0] as any;
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('byFormat');
      expect(report).toHaveProperty('recentJobs');
      expect(typeof report.summary.totalJobs).toBe('number');
      expect(typeof report.summary.successRate).toBe('number');
      expect(Array.isArray(report.byFormat)).toBe(true);
      expect(Array.isArray(report.recentJobs)).toBe(true);
    });

    it('respects limit filter for recentJobs', async () => {
      const agent = new ScheduledReportDeliveryAgent();
      const result = await agent.execute({ limit: 5 });

      const report = result.data![0] as any;
      expect(report.recentJobs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const agent = new ScheduledReportDeliveryAgent();
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
