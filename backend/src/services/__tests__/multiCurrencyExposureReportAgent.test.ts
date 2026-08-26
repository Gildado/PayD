/**
 * Tests for MultiCurrencyExposureReportAgent
 */

import { describe, it, expect } from '@jest/globals';
import { MultiCurrencyExposureReportAgent } from '../multiCurrencyExposureReportAgent.js';

describe('MultiCurrencyExposureReportAgent', () => {
  describe('execute()', () => {
    it('returns a valid ReportResult with empty data when no holdings exist', async () => {
      const agent = new MultiCurrencyExposureReportAgent();
      const result = await agent.execute();

      expect(result.format).toBe('JSON');
      expect(result.data).toHaveLength(1);
      expect(result.metadata.schema).toBe('multi-currency-exposure');

      const report = result.data![0] as any;
      expect(report.summary.totalHeldBase).toBe(0);
      expect(report.summary.totalPayableBase).toBe(0);
      expect(report.summary.netExposureBase).toBe(0);
      expect(report.summary.currencyCount).toBe(0);
      expect(report.summary.baseCurrency).toBe('USD');
      expect(report.byCurrency).toHaveLength(0);
    });

    it('returns valid schema structure', async () => {
      const agent = new MultiCurrencyExposureReportAgent();
      const result = await agent.execute();

      const report = result.data![0] as any;
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('byCurrency');
      expect(report).toHaveProperty('exchangeRates');
      expect(typeof report.summary.totalHeldBase).toBe('number');
      expect(typeof report.summary.totalPayableBase).toBe('number');
      expect(typeof report.summary.netExposureBase).toBe('number');
      expect(typeof report.summary.currencyCount).toBe('number');
      expect(typeof report.summary.baseCurrency).toBe('string');
      expect(Array.isArray(report.byCurrency)).toBe(true);
      expect(typeof report.exchangeRates).toBe('object');
    });

    it('accepts custom base currency', async () => {
      const agent = new MultiCurrencyExposureReportAgent();
      const result = await agent.execute({ baseCurrency: 'EUR' });

      const report = result.data![0] as any;
      expect(report.summary.baseCurrency).toBe('EUR');
    });
  });

  describe('validate()', () => {
    it('returns valid', async () => {
      const agent = new MultiCurrencyExposureReportAgent();
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
