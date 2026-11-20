/**
 * Tests for RevenueSplitDistributionReportAgent
 */

import { describe, it, expect } from '@jest/globals';
import { RevenueSplitDistributionReportAgent } from '../revenueSplitDistributionReportAgent.js';

describe('RevenueSplitDistributionReportAgent', () => {
  describe('execute()', () => {
    it('returns a valid ReportResult with empty data when no distributions exist', async () => {
      const agent = new RevenueSplitDistributionReportAgent();
      const result = await agent.execute();

      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);
      expect(result.metadata.schema).toBe('revenue-split-distribution');

      const report = result.data![0] as any;
      expect(report.summary.totalDistributions).toBe(0);
      expect(report.summary.totalDistributedAmount).toBe(0);
      expect(report.summary.uniqueTokens).toBe(0);
      expect(report.summary.recipientCount).toBe(0);
      expect(report.byToken).toHaveLength(0);
      expect(report.byRecipient).toHaveLength(0);
      expect(report.distributionTimeline).toHaveLength(0);
    });

    it('returns valid schema structure', async () => {
      const agent = new RevenueSplitDistributionReportAgent();
      const result = await agent.execute();

      const report = result.data![0] as any;
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('byToken');
      expect(report).toHaveProperty('byRecipient');
      expect(report).toHaveProperty('distributionTimeline');
      expect(typeof report.summary.totalDistributions).toBe('number');
      expect(typeof report.summary.totalDistributedAmount).toBe('number');
      expect(typeof report.summary.uniqueTokens).toBe('number');
      expect(typeof report.summary.recipientCount).toBe('number');
      expect(typeof report.summary.avgDistributionAmount).toBe('number');
      expect(Array.isArray(report.byToken)).toBe(true);
      expect(Array.isArray(report.byRecipient)).toBe(true);
      expect(Array.isArray(report.distributionTimeline)).toBe(true);
    });

    it('respects date filters', async () => {
      const agent = new RevenueSplitDistributionReportAgent();
      const result = await agent.execute({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const agent = new RevenueSplitDistributionReportAgent();
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
