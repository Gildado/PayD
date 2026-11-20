import { FxRateAnomalyDetectionAgent } from '../fxRateAnomalyDetectionAgent.js';
import type { OrgUsdRatesPayload } from '../fxRateService.js';

const NOW = Date.parse('2026-10-17T12:00:00.000Z');

function makePayload(overrides: Partial<OrgUsdRatesPayload> = {}): OrgUsdRatesPayload {
  return {
    base: 'ORGUSD',
    quoteBase: 'USD',
    fetchedAt: new Date(NOW - 60_000).toISOString(),
    provider: 'open.er-api.com',
    rates: { USD: 1, ORGUSD: 1, NGN: 1500, EUR: 0.92 },
    cacheTtlSeconds: 300,
    ...overrides,
  };
}

describe('FxRateAnomalyDetectionAgent (#1198)', () => {
  let agent: FxRateAnomalyDetectionAgent;

  beforeEach(() => {
    agent = new FxRateAnomalyDetectionAgent({ maxStalenessMs: 900_000, maxDeviationRatio: 0.05 });
  });

  it('detects a stale payload and an abnormal rate jump (True Positive)', async () => {
    const current = makePayload({
      fetchedAt: new Date(NOW - 2 * 3_600_000).toISOString(),
      rates: { USD: 1, ORGUSD: 1, NGN: 1800, EUR: 0.92 },
    });
    const previous = makePayload();

    const anomalies = await agent.evaluatePayload({ current, previous, now: NOW });

    expect(anomalies.some((a) => a.reason === 'fx_rate_stale')).toBe(true);
    const deviation = anomalies.find((a) => a.reason === 'fx_rate_deviation');
    expect(deviation?.severity).toBe('critical');
    expect(deviation?.metadata.currency).toBe('NGN');
  });

  it('does not fire for a fresh payload with small rate movement (True Negative)', async () => {
    const current = makePayload({
      rates: { USD: 1, ORGUSD: 1, NGN: 1510, EUR: 0.921 },
    });
    const previous = makePayload({
      fetchedAt: new Date(NOW - 5 * 60_000).toISOString(),
    });

    const anomalies = await agent.evaluatePayload({ current, previous, now: NOW });

    expect(anomalies).toHaveLength(0);
  });
});
