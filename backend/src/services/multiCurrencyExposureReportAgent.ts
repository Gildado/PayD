/**
 * Multi-Currency Exposure Report Agent (#1302)
 *
 * Reports an organization's currency exposure across all held and payable
 * assets, with exchange-rate-normalized totals in the base currency.
 *
 * Output schema:
 *   - summary: totalHeld (base), totalPayable (base), netExposure, currencyCount
 *   - byCurrency: per-currency held/payable/exposure breakdown
 *   - exchangeRates: rates used for normalization
 */

import {
  type IReportAgent,
  type ReportResult,
  type SafetyValidation,
  ReportFormat,
} from './reportSchema.js';

export interface CurrencyExposureFilters {
  organizationPublicKey?: string;
  baseCurrency?: string;
}

export interface CurrencyHolding {
  currency: string;
  held: number;
  payable: number;
  netExposure: number;
  exchangeRate: number;
  heldBaseEquivalent: number;
  payableBaseEquivalent: number;
}

export interface MultiCurrencyExposureReport {
  summary: {
    totalHeldBase: number;
    totalPayableBase: number;
    netExposureBase: number;
    currencyCount: number;
    baseCurrency: string;
  };
  byCurrency: CurrencyHolding[];
  exchangeRates: Record<string, number>;
}

export class MultiCurrencyExposureReportAgent implements IReportAgent {
  id = 'multi-currency-exposure';
  name = 'Multi-Currency Exposure Report';
  description = "Reports an org's currency exposure across held and payable assets";

  async execute(filters?: Record<string, any>): Promise<ReportResult> {
    const f = filters as CurrencyExposureFilters | undefined;
    const baseCurrency = f?.baseCurrency ?? 'USD';

    const { holdings, rates } = await this.fetchCurrencyData(f);

    // Aggregate per-currency
    const currencyMap = new Map<string, { held: number; payable: number }>();
    for (const h of holdings) {
      const entry = currencyMap.get(h.currency) ?? { held: 0, payable: 0 };
      if (h.type === 'held') {
        entry.held += h.balance;
      } else {
        entry.payable += h.balance;
      }
      currencyMap.set(h.currency, entry);
    }

    const byCurrency: CurrencyHolding[] = [...currencyMap.entries()].map(([currency, { held, payable }]) => {
      const rate = rates[currency] ?? 1;
      const baseRate = rates[baseCurrency] ?? 1;
      const normalizedRate = baseRate > 0 ? rate / baseRate : 1;
      return {
        currency,
        held,
        payable,
        netExposure: held - payable,
        exchangeRate: normalizedRate,
        heldBaseEquivalent: Math.round(held / normalizedRate),
        payableBaseEquivalent: Math.round(payable / normalizedRate),
      };
    });

    // Sort by held base equivalent descending
    byCurrency.sort((a, b) => b.heldBaseEquivalent - a.heldBaseEquivalent);

    const totalHeldBase = byCurrency.reduce((s, c) => s + c.heldBaseEquivalent, 0);
    const totalPayableBase = byCurrency.reduce((s, c) => s + c.payableBaseEquivalent, 0);

    const report: MultiCurrencyExposureReport = {
      summary: {
        totalHeldBase,
        totalPayableBase,
        netExposureBase: totalHeldBase - totalPayableBase,
        currencyCount: byCurrency.length,
        baseCurrency,
      },
      byCurrency,
      exchangeRates: rates,
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
        schema: 'multi-currency-exposure',
        checksum: '',
      },
    };
  }

  async validate(): Promise<SafetyValidation> {
    return { isValid: true, issues: [], piiDetected: [] };
  }

  private async fetchCurrencyData(_filters?: CurrencyExposureFilters): Promise<{
    holdings: Array<{ currency: string; balance: number; type: 'held' | 'payable' }>;
    rates: Record<string, number>;
  }> {
    // In production, query from the Stellar ledger and the currency
    // conversion service. The agent defines the aggregation schema.
    return { holdings: [], rates: {} };
  }
}
