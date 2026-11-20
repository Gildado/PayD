// Fixture data for MultiCurrencyExposureReportAgent tests.
// Pre-computed expected values for deterministic test assertions.

export const FIXTURE_ORG_ID = 52;

export interface FixtureCurrencyHolding {
  currency: string;
  balance: number;
  type: 'held' | 'payable';
}

export interface FixtureExchangeRate {
  from: string;
  to: string;
  rate: number;
}

export const FIXTURE_HOLDINGS: FixtureCurrencyHolding[] = [
  { currency: 'USD', balance: 50000, type: 'held' },
  { currency: 'USD', balance: 12000, type: 'payable' },
  { currency: 'NGN', balance: 8000000, type: 'held' },
  { currency: 'NGN', balance: 2500000, type: 'payable' },
  { currency: 'EUR', balance: 15000, type: 'held' },
  { currency: 'EUR', balance: 5000, type: 'payable' },
  { currency: 'GBP', balance: 8000, type: 'held' },
  { currency: 'KES', balance: 2000000, type: 'payable' },
  { currency: 'ZAR', balance: 500000, type: 'held' },
  { currency: 'INR', balance: 3000000, type: 'held' },
];

export const FIXTURE_RATES: Record<string, number> = {
  USD: 1,
  NGN: 1550,
  EUR: 0.92,
  GBP: 0.79,
  KES: 153,
  GHS: 12.5,
  ZAR: 18.2,
  INR: 83.1,
};

// Pre-computed expected values (all amounts in USD equivalent)
export const FIXTURE_EXPECTED = {
  totalHeldUSD: Math.round(50000 + 8000000 / 1550 + 15000 / 0.92 + 8000 / 0.79 + 500000 / 18.2 + 3000000 / 83.1),
  totalPayableUSD: Math.round(12000 + 2500000 / 1550 + 5000 / 0.92 + 2000000 / 153),
  netExposureUSD: 0, // computed below
  currencyCount: 6,
  heldCurrencyCount: 5,
  payableCurrencyCount: 4,
  largestHoldingCurrency: 'USD',
  largestPayableCurrency: 'USD',
} as const;

// Compute net exposure
const totalHeld = 50000 + 8000000 / 1550 + 15000 / 0.92 + 8000 / 0.79 + 500000 / 18.2 + 3000000 / 83.1;
const totalPayable = 12000 + 2500000 / 1550 + 5000 / 0.92 + 2000000 / 153;
(FIXTURE_EXPECTED as any).netExposureUSD = Math.round(totalHeld - totalPayable);
(FIXTURE_EXPECTED as any).totalHeldUSD = Math.round(totalHeld);
(FIXTURE_EXPECTED as any).totalPayableUSD = Math.round(totalPayable);
