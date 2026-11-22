import { getRedisClient } from './rateLimitService.js';
import logger from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { RateValidationError } from './errors/RateValidationError.js';
import { fxRateAnomalyDetectionAgent } from './fxRateAnomalyDetectionAgent.js';

export const FX_RATES_CACHE_KEY = 'payd:fx:rates:orgusd';
export const FX_RATES_CACHE_TTL_SEC = 300;

export interface OrgUsdRatesPayload {
  base: 'ORGUSD';
  quoteBase: 'USD';
  fetchedAt: string;
  provider: string;
  rates: Record<string, number>;
  cacheTtlSeconds: number;
}

export interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  fetchedAt: string;
  provider: string;
}

const memoryFallback: { payload: OrgUsdRatesPayload | null; expiresAt: number } = {
  payload: null,
  expiresAt: 0,
};

export function clearFxRateMemoryCache(): void {
  memoryFallback.payload = null;
  memoryFallback.expiresAt = 0;
}

function normalizeRates(rates: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { USD: 1, ORGUSD: 1 };
  for (const [k, v] of Object.entries(rates)) {
    const key = k.toUpperCase();
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v;
    }
  }
  return out;
}

function buildPayload(rates: Record<string, number>, provider: string): OrgUsdRatesPayload {
  return {
    base: 'ORGUSD',
    quoteBase: 'USD',
    fetchedAt: new Date().toISOString(),
    provider,
    rates: normalizeRates(rates),
    cacheTtlSeconds: FX_RATES_CACHE_TTL_SEC,
  };
}

/** Free fiat rates (no API key). exchangerate.host now requires access_key. */
async function fetchOpenErApi(): Promise<Record<string, number>> {
  const url = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`open.er-api.com HTTP ${res.status}`);
  }
  const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (data.result !== 'success' || !data.rates || typeof data.rates !== 'object') {
    throw new Error('open.er-api.com invalid response');
  }
  return data.rates;
}

async function fetchCoinbase(): Promise<Record<string, number>> {
  const url = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`coinbase HTTP ${res.status}`);
  }
  const data = (await res.json()) as { data?: { rates?: Record<string, string> } };
  const raw = data.data?.rates;
  if (!raw || typeof raw !== 'object') {
    throw new Error('coinbase invalid rates');
  }
  const rates: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) {
      rates[k.toUpperCase()] = n;
    }
  }
  return rates;
}

async function fetchLiveRates(): Promise<{ rates: Record<string, number>; provider: string }> {
  try {
    const rates = await withRetry(() => fetchOpenErApi());
    return { rates, provider: 'open.er-api.com' };
  } catch (primaryErr) {
    logger.warn('FX primary provider failed, trying Coinbase', {
      error: (primaryErr as Error).message,
    });
    const rates = await withRetry(() => fetchCoinbase());
    return { rates, provider: 'api.coinbase.com' };
  }
}

/**
 * ORGUSD is treated as 1:1 USD. Rates map currency code → units of that currency per 1 ORGUSD/USD.
 * Cached in Redis for FX_RATES_CACHE_TTL_SEC when REDIS_URL is set; otherwise short in-memory cache.
 */
export async function getOrgUsdRates(): Promise<OrgUsdRatesPayload> {
  const redis = getRedisClient();
  const now = Date.now();

  if (redis) {
    try {
      const cached = await redis.get(FX_RATES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as OrgUsdRatesPayload;
      }
    } catch (err) {
      logger.warn('FX Redis get failed', { error: (err as Error).message });
    }
  } else if (memoryFallback.payload && memoryFallback.expiresAt > now) {
    return memoryFallback.payload;
  }

  try {
    const { rates, provider } = await fetchLiveRates();
    const payload = buildPayload(rates, provider);
    const serialized = JSON.stringify(payload);

    if (redis) {
      try {
        await redis.setex(FX_RATES_CACHE_KEY, FX_RATES_CACHE_TTL_SEC, serialized);
      } catch (err) {
        logger.warn('FX Redis set failed, using memory cache', { error: (err as Error).message });
        memoryFallback.payload = payload;
        memoryFallback.expiresAt = now + FX_RATES_CACHE_TTL_SEC * 1000;
      }
    } else {
      memoryFallback.payload = payload;
      memoryFallback.expiresAt = now + FX_RATES_CACHE_TTL_SEC * 1000;
    }

    return payload;
  } catch (error) {
    logger.error('FX providers unavailable', { error: (error as Error).message });
    if (memoryFallback.payload) {
      return memoryFallback.payload;
    }
    throw error;
  }
}

export async function convertOrgUsdAmount(
  amount: number,
  from: string,
  to: string
): Promise<ConversionResult> {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  const normalizedFrom = from.trim().toUpperCase();
  const normalizedTo = to.trim().toUpperCase();
  const payload = await getOrgUsdRates();
  
  // Validate rates before conversion
  await validateRatesForQuoting(payload);
  
  const fromRate = payload.rates[normalizedFrom];
  const toRate = payload.rates[normalizedTo];

  if (!fromRate) {
    throw new Error(`Unsupported source currency: ${normalizedFrom}`);
  }

  if (!toRate) {
    throw new Error(`Unsupported target currency: ${normalizedTo}`);
  }

  const rate = toRate / fromRate;

  return {
    from: normalizedFrom,
    to: normalizedTo,
    amount,
    convertedAmount: Number((amount * rate).toFixed(6)),
    rate,
    fetchedAt: payload.fetchedAt,
    provider: payload.provider,
  };
}

/**
 * Validates FX rates for use in payroll quoting.
 * Throws RateValidationError if rates are stale or anomalous.
 * 
 * @param payload The rate payload to validate
 * @param previousPayload Optional previous payload to check for anomalies
 * @throws RateValidationError if validation fails
 */
export async function validateRatesForQuoting(
  payload: OrgUsdRatesPayload,
  previousPayload?: OrgUsdRatesPayload
): Promise<void> {
  // Run anomaly detection
  const anomalies = await fxRateAnomalyDetectionAgent.evaluatePayload({
    current: payload,
    previous: previousPayload,
  });

  if (anomalies.length === 0) {
    return; // All good
  }

  // Check for critical anomalies that should block quoting
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');
  const staleness = anomalies.find((a) => a.reason === 'fx_rate_stale');

  if (criticalAnomalies.length > 0) {
    const criticalReasons = criticalAnomalies
      .map((a) => a.reason)
      .join(', ');

    if (criticalReasons.includes('fx_rate_invalid')) {
      throw new RateValidationError(
        'INVALID_RATE',
        `Rates from ${payload.provider} contain invalid values`,
        {
          provider: payload.provider,
          fetchedAt: payload.fetchedAt,
          invalidCurrencies: criticalAnomalies
            .filter((a) => a.reason === 'fx_rate_invalid')
            .flatMap((a) => (a.metadata as any).currencies || []),
          anomalies: anomalies.map((a) => ({
            reason: a.reason,
            description: a.description,
          })),
        }
      );
    }

    if (criticalReasons.includes('fx_rate_deviation')) {
      const deviationAnomaly = criticalAnomalies.find((a) => a.reason === 'fx_rate_deviation');
      const metadata = deviationAnomaly?.metadata as any;

      throw new RateValidationError(
        'OUTLIER_DETECTED',
        `FX rate for ${metadata?.currency} moved ${(metadata?.deviationRatio || 0) * 100}% between consecutive payloads, exceeding configured threshold`,
        {
          provider: payload.provider,
          fetchedAt: payload.fetchedAt,
          currency: metadata?.currency,
          deviation: metadata?.deviationRatio,
          maxDeviation: metadata?.maxDeviationRatio,
        }
      );
    }
  }

  // Block on stale rates (warning level but operational requirement)
  if (staleness) {
    const now = Date.now();
    const fetchedAt = new Date(payload.fetchedAt).getTime();
    const ageMs = now - fetchedAt;
    const maxAgeMs = readRateMaxAgeMs();

    throw new RateValidationError(
      'STALE_RATE',
      `FX rates from ${payload.provider} are stale (${Math.round(ageMs / 1000)}s old), exceeding max age of ${Math.round(maxAgeMs / 1000)}s`,
      {
        provider: payload.provider,
        fetchedAt: payload.fetchedAt,
        actualAge: ageMs,
        maxAge: maxAgeMs,
      }
    );
  }
}

/**
 * Read FX rate max age from environment or use default
 * Default: 15 minutes (900,000ms)
 */
function readRateMaxAgeMs(): number {
  const maxAgeMs = Number(process.env.FX_RATE_MAX_AGE_MS);
  return Number.isFinite(maxAgeMs) && maxAgeMs > 0 ? maxAgeMs : 900_000;
}
