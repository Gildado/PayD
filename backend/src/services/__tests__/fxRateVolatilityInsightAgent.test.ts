/**
 * Tests for FxRateVolatilityInsightAgent (#1317)
 *
 * Uses a fixture payload so no Redis or network calls are made.
 */

import { describe, it, expect } from '@jest/globals';
import { FxRateVolatilityInsightAgent, type FxRateVolatilityReport } from '../fxRateVolatilityInsightAgent.js';
import { type OrgUsdRatesPayload } from '../fxRateService.js';

const FIXTURE_PAYLOAD: OrgUsdRatesPayload = {
  base: 'ORGUSD',
  quoteBase: 'USD',
  fetchedAt: '2026-08-27T00:00:00.000Z',
  provider: 'fixture',
  cacheTtlSeconds: 300,
  rates: {
    USD: 1,
    ORGUSD: 1,
    EUR: 0.92,
    GBP: 0.79,
    NGN: 1550,
    KES: 130,
    GHS: 15.5,
  },
};

class TestAgent extends FxRateVolatilityInsightAgent {
  protected override async fetchRates(): Promise<OrgUsdRatesPayload> {
    return FIXTURE_PAYLOAD;
  }
}

describe('FxRateVolatilityInsightAgent', () => {
  describe('execute()', () => {
    it('returns a valid ReportResult with correct schema keys', async () => {
      const agent = new TestAgent();
      const result = await agent.execute();

      expect(result.format).toBe('JSON');
      expect(result.metadata.schema).toBe('fx-rate-volatility-insight');
      expect(result.data).toHaveLength(1);

      const report = result.data![0] as unknown as FxRateVolatilityReport;
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('stats');
      expect(report).toHaveProperty('byCurrency');
    });

    it('excludes ORGUSD from analysis (synthetic peg, not a real FX rate)', async () => {
      const agent = new TestAgent();
      const result = await agent.execute();
      const report = result.data![0] as unknown as FxRateVolatilityReport;

      const currencies = report.byCurrency.map((r) => r.currency);
      expect(currencies).not.toContain('ORGUSD');
    });

    it('reports correct window currency count', async () => {
      const agent = new TestAgent();
      const result = await agent.execute();
      const report = result.data![0] as unknown as FxRateVolatilityReport;

      // fixture has 7 entries; ORGUSD is excluded → 6
      expect(report.summary.windowCurrencies).toBe(6);
      expect(report.byCurrency).toHaveLength(6);
    });

    it('computes stats that are mathematically consistent', async () => {
      const agent = new TestAgent();
      const result = await agent.execute();
      const report = result.data![0] as unknown as FxRateVolatilityReport;
      const { mean, stdDev, min, max, spreadPct } = report.stats;

      expect(mean).toBeGreaterThan(0);
      expect(stdDev).toBeGreaterThanOrEqual(0);
      expect(min).toBeLessThanOrEqual(mean);
      expect(max).toBeGreaterThanOrEqual(mean);
      expect(spreadPct).toBeCloseTo(((max - min) / mean) * 100, 5);
    });

    it('flags NGN as a high-volatility outlier against low-value currencies', async () => {
      const agent = new TestAgent();
      const result = await agent.execute();
      const report = result.data![0] as unknown as FxRateVolatilityReport;

      const ngn = report.byCurrency.find((r) => r.currency === 'NGN');
      expect(ngn).toBeDefined();
      expect(ngn!.isOutlier).toBe(true);
    });

    it('respects the currencies filter', async () => {
      const agent = new TestAgent();
      const result = await agent.execute({ currencies: ['EUR', 'GBP', 'USD'] });
      const report = result.data![0] as unknown as FxRateVolatilityReport;

      expect(report.summary.windowCurrencies).toBe(3);
      const codes = report.byCurrency.map((r) => r.currency);
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
      expect(codes).toContain('USD');
      expect(codes).not.toContain('NGN');
    });

    it('respects a custom outlierSigmaThreshold', async () => {
      const agent = new TestAgent();
      // Very tight threshold — most currencies become outliers
      const tightResult = await agent.execute({ outlierSigmaThreshold: 0.1 });
      const tightReport = tightResult.data![0] as unknown as FxRateVolatilityReport;

      // Very loose threshold — nothing should be an outlier
      const looseResult = await agent.execute({ outlierSigmaThreshold: 100 });
      const looseReport = looseResult.data![0] as unknown as FxRateVolatilityReport;

      expect(tightReport.summary.highVolatilityCurrencies).toBeGreaterThan(
        looseReport.summary.highVolatilityCurrencies
      );
      expect(looseReport.summary.highVolatilityCurrencies).toBe(0);
    });

    it('sorts byCurrency by deviation descending', async () => {
      const agent = new TestAgent();
      const result = await agent.execute();
      const report = result.data![0] as unknown as FxRateVolatilityReport;

      for (let i = 1; i < report.byCurrency.length; i++) {
        expect(report.byCurrency[i - 1].deviation).toBeGreaterThanOrEqual(
          report.byCurrency[i].deviation
        );
      }
    });

    it('carries provider and fetchedAt through from the rate payload', async () => {
      const agent = new TestAgent();
      const result = await agent.execute();
      const report = result.data![0] as unknown as FxRateVolatilityReport;

      expect(report.summary.provider).toBe('fixture');
      expect(report.summary.analysedAt).toBe('2026-08-27T00:00:00.000Z');
    });
  });

  describe('validate()', () => {
    it('returns valid with no issues', async () => {
      const agent = new TestAgent();
      const v = await agent.validate();
      expect(v.isValid).toBe(true);
      expect(v.issues).toHaveLength(0);
      expect(v.piiDetected).toHaveLength(0);
    });
  });
});
