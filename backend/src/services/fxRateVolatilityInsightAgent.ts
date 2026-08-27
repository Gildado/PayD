/**
 * FX Rate Volatility Insight Agent (#1317)
 *
 * Analyses a snapshot of FX rates fetched from fxRateService and surfaces
 * volatility indicators — spread, coefficient of variation, and outlier
 * detection — so org admins can understand payroll conversion risk at a glance.
 *
 * Output schema:
 *   - summary: windowCurrencies, highVolatilityCurrencies, analysedAt
 *   - byCurrency: currency, rate, deviation, cvPct, isOutlier
 *   - stats: mean, stdDev, min, max, spreadPct
 */

import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';
import { type OrgUsdRatesPayload } from './fxRateService.js';

export interface FxVolatilityFilters {
  /** Restrict analysis to these currency codes; defaults to all available. */
  currencies?: string[];
  /** Outlier threshold: currencies whose deviation from the mean exceeds this
   *  multiple of the standard deviation are flagged. Defaults to 2.0. */
  outlierSigmaThreshold?: number;
}

export interface CurrencyVolatilityRow {
  currency: string;
  rate: number;
  /** Absolute deviation from the cross-currency mean rate. */
  deviation: number;
  /** Coefficient of variation as a percentage (stdDev / mean * 100). */
  cvPct: number;
  isOutlier: boolean;
}

export interface FxRateVolatilityReport {
  summary: {
    windowCurrencies: number;
    highVolatilityCurrencies: number;
    analysedAt: string;
    provider: string;
    outlierSigmaThreshold: number;
  };
  stats: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    spreadPct: number;
  };
  byCurrency: CurrencyVolatilityRow[];
}

function computeStats(rates: number[]): { mean: number; stdDev: number; min: number; max: number; spreadPct: number } {
  if (rates.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, spreadPct: 0 };
  }
  const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
  const variance = rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const spreadPct = mean > 0 ? ((max - min) / mean) * 100 : 0;
  return { mean, stdDev, min, max, spreadPct };
}

export class FxRateVolatilityInsightAgent implements IReportAgent {
  id = 'fx-rate-volatility-insight';
  name = 'FX Rate Volatility Insight Report';
  description = 'Surfaces FX rate volatility indicators to help admins assess payroll conversion risk';

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as FxVolatilityFilters | undefined;
    const sigmaThreshold = f?.outlierSigmaThreshold ?? 2.0;

    const payload = await this.fetchRates();

    let entries = Object.entries(payload.rates).filter(
      ([currency]) => currency !== 'ORGUSD'
    );

    if (f?.currencies && f.currencies.length > 0) {
      const wanted = new Set(f.currencies.map((c) => c.toUpperCase()));
      entries = entries.filter(([currency]) => wanted.has(currency));
    }

    const values = entries.map(([, rate]) => rate);
    const { mean, stdDev, min, max, spreadPct } = computeStats(values);
    const cvPct = mean > 0 ? (stdDev / mean) * 100 : 0;

    const byCurrency: CurrencyVolatilityRow[] = entries.map(([currency, rate]) => {
      const deviation = Math.abs(rate - mean);
      const isOutlier = stdDev > 0 && deviation > sigmaThreshold * stdDev;
      return { currency, rate, deviation, cvPct, isOutlier };
    });

    byCurrency.sort((a, b) => b.deviation - a.deviation);

    const report: FxRateVolatilityReport = {
      summary: {
        windowCurrencies: byCurrency.length,
        highVolatilityCurrencies: byCurrency.filter((r) => r.isOutlier).length,
        analysedAt: payload.fetchedAt,
        provider: payload.provider,
        outlierSigmaThreshold: sigmaThreshold,
      },
      stats: { mean, stdDev, min, max, spreadPct },
      byCurrency,
    };

    return {
      executionId: crypto.randomUUID(),
      format: ReportFormat.JSON,
      data: [report as unknown as Record<string, any>],
      summary: {
        totalRecords: byCurrency.length,
        processedRecords: byCurrency.length,
        failedRecords: 0,
        generatedAt: new Date(),
        generatedBy: 0,
      },
      metadata: {
        version: '1.0',
        schema: 'fx-rate-volatility-insight',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }

  /** Overridable in tests to inject fixture data without hitting Redis/network. */
  protected async fetchRates(): Promise<OrgUsdRatesPayload> {
    const { getOrgUsdRates } = await import('./fxRateService.js');
    return getOrgUsdRates();
  }
}
