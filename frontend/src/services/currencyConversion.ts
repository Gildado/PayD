/**
 * Currency conversion service for real-time local currency estimation.
 * Provides USDC/XLM to fiat conversions using public exchange rate APIs.
 */

export interface ExchangeRates {
  usd: number;
  ngn: number;
  eur: number;
  gbp: number;
  kes: number;
  ghs: number;
  zar: number;
  inr: number;
}

export interface ConvertedBalance {
  originalAmount: number;
  originalCurrency: string;
  localAmount: number;
  localCurrency: string;
  exchangeRate: number;
  lastUpdated: Date;
}

const SUPPORTED_CURRENCIES: Record<string, string> = {
  USD: 'US Dollar',
  NGN: 'Nigerian Naira',
  EUR: 'Euro',
  GBP: 'British Pound',
  KES: 'Kenyan Shilling',
  GHS: 'Ghanaian Cedi',
  ZAR: 'South African Rand',
  INR: 'Indian Rupee',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  NGN: '₦',
  EUR: '€',
  GBP: '£',
  KES: 'KSh',
  GHS: 'GH₵',
  ZAR: 'R',
  INR: '₹',
};

// Cache exchange rates for 5 minutes
let cachedRates: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch exchange rates for USD to local currencies.
 * Since ORGUSD is pegged 1:1 to USD, we use USD as base.
 */
export async function fetchExchangeRates(): Promise<Record<string, number>> {
  // Check cache
  if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_TTL) {
    return cachedRates.rates;
  }

  try {
    // Use a free exchange rate API
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd,ngn,eur,gbp,kes,ghs,zar,inr'
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      'usd-coin'?: Record<string, number>;
    };
    const usdcRates = data['usd-coin'] ?? {};

    const rates: Record<string, number> = {
      USD: usdcRates.usd ?? 1,
      NGN: usdcRates.ngn ?? 1580,
      EUR: usdcRates.eur ?? 0.92,
      GBP: usdcRates.gbp ?? 0.79,
      KES: usdcRates.kes ?? 129,
      GHS: usdcRates.ghs ?? 16.5,
      ZAR: usdcRates.zar ?? 18.2,
      INR: usdcRates.inr ?? 83.5,
    };

    cachedRates = { rates, timestamp: Date.now() };
    return rates;
  } catch (error) {
    console.warn('Failed to fetch live rates, using fallback:', error);

    // Fallback rates
    const fallbackRates: Record<string, number> = {
      USD: 1,
      NGN: 1580,
      EUR: 0.92,
      GBP: 0.79,
      KES: 129,
      GHS: 16.5,
      ZAR: 18.2,
      INR: 83.5,
    };
    cachedRates = { rates: fallbackRates, timestamp: Date.now() };
    return fallbackRates;
  }
}

/**
 * Convert an ORGUSD amount to a local currency
 */
export async function convertToLocal(
  amount: number,
  targetCurrency: string
): Promise<ConvertedBalance> {
  const rates = await fetchExchangeRates();
  const rate = rates[targetCurrency.toUpperCase()] || 1;

  return {
    originalAmount: amount,
    originalCurrency: 'ORGUSD',
    localAmount: amount * rate,
    localCurrency: targetCurrency.toUpperCase(),
    exchangeRate: rate,
    lastUpdated: new Date(),
  };
}

/**
 * Format currency with locale-appropriate symbols
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;

  if (currency === 'USD' || currency === 'ORGUSD') {
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
}

export function getSupportedCurrencies(): Record<string, string> {
  return SUPPORTED_CURRENCIES;
}

/**
 * Generate Stellar Expert deep link for a transaction hash
 */
export function getStellarExpertLink(
  txHash: string,
  network: 'public' | 'testnet' = 'testnet'
): string {
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

/**
 * Generate Stellar Expert link for an account
 */
export function getStellarExpertAccountLink(
  publicKey: string,
  network: 'public' | 'testnet' = 'testnet'
): string {
  return `https://stellar.expert/explorer/${network}/account/${publicKey}`;
}
