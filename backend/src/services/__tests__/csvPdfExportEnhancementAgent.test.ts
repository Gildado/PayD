/**
 * Tests for CsvPdfExportEnhancementAgent
 */

import { describe, it, expect } from '@jest/globals';
import { CsvPdfExportEnhancementAgent } from '../csvPdfExportEnhancementAgent.js';

describe('CsvPdfExportEnhancementAgent', () => {
  describe('execute()', () => {
    it('returns a valid ReportResult with empty data when no exports exist', async () => {
      const agent = new CsvPdfExportEnhancementAgent();
      const result = await agent.execute();

      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);
      expect(result.metadata.schema).toBe('csv-pdf-export-enhancement');

      const report = result.data![0] as any;
      expect(report.summary.totalExports).toBe(0);
      expect(report.summary.successfulExports).toBe(0);
      expect(report.summary.failedExports).toBe(0);
      expect(report.columnUsage).toHaveLength(0);
      expect(report.formatBreakdown).toHaveLength(0);
    });

    it('returns valid schema structure', async () => {
      const agent = new CsvPdfExportEnhancementAgent();
      const result = await agent.execute();

      const report = result.data![0] as any;
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('columnUsage');
      expect(report).toHaveProperty('formatBreakdown');
      expect(report).toHaveProperty('recommendations');
      expect(typeof report.summary.totalExports).toBe('number');
      expect(typeof report.summary.avgRowCount).toBe('number');
      expect(typeof report.summary.avgFileSize).toBe('number');
      expect(Array.isArray(report.columnUsage)).toBe(true);
      expect(Array.isArray(report.formatBreakdown)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('respects date filters', async () => {
      const agent = new CsvPdfExportEnhancementAgent();
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
      const agent = new CsvPdfExportEnhancementAgent();
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
