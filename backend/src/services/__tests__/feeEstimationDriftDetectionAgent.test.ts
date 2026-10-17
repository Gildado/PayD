import { FeeEstimationDriftDetectionAgent } from '../feeEstimationDriftDetectionAgent.js';
import type { FeeRecommendation } from '../feeEstimationService.js';

function makeRecommendation(overrides: Partial<FeeRecommendation> = {}): FeeRecommendation {
  return {
    baseFee: 100,
    recommendedFee: 100,
    maxFee: 200,
    congestionLevel: 'low',
    shouldBumpFee: false,
    ledgerCapacityUsage: 0.1,
    lastLedger: 50000000,
    recommendedFeeXLM: { asset: { code: 'XLM' }, value: '0.0000100' },
    maxFeeXLM: { asset: { code: 'XLM' }, value: '0.0000200' },
    baseFeeXLM: { asset: { code: 'XLM' }, value: '0.0000100' },
    ...overrides,
  };
}

describe('FeeEstimationDriftDetectionAgent (#1201)', () => {
  let agent: FeeEstimationDriftDetectionAgent;

  beforeEach(() => {
    agent = new FeeEstimationDriftDetectionAgent({
      minSamplesForBaseline: 5,
      driftMultiplierThreshold: 3.0,
      maxAllowedFeeStroops: 10_000,
    });
  });

  it('detects sharp fee drift from rolling baseline (True Positive)', async () => {
    // Establish baseline at ~100 Stroops
    for (let i = 0; i < 5; i++) {
      await agent.evaluateRecommendation({
        recommendation: makeRecommendation({ recommendedFee: 100 }),
      });
    }

    // Spike: fee jumps to 500 Stroops (5x baseline)
    const anomalies = await agent.evaluateRecommendation({
      recommendation: makeRecommendation({ recommendedFee: 500 }),
    });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies.some((a) => a.reason === 'fee_surge_drift')).toBe(true);
    expect(anomalies[0].metadata.driftRatio).toBeGreaterThanOrEqual(3.0);
  });

  it('detects absolute fee surge exceeding maximum ceiling (True Positive)', async () => {
    const anomalies = await agent.evaluateRecommendation({
      recommendation: makeRecommendation({ recommendedFee: 15_000 }), // > 10,000 ceiling
    });

    expect(anomalies.some((a) => a.reason === 'absolute_fee_surge')).toBe(true);
    expect(anomalies[0].severity).toBe('critical');
  });

  it('detects fee underestimation under high network congestion (True Positive)', async () => {
    // 92% capacity usage, but fee is stuck at baseFee (100 Stroops)
    const anomalies = await agent.evaluateRecommendation({
      recommendation: makeRecommendation({
        recommendedFee: 100,
        baseFee: 100,
        ledgerCapacityUsage: 0.92,
        congestionLevel: 'high',
      }),
    });

    expect(anomalies.some((a) => a.reason === 'congestion_underestimation_inversion')).toBe(true);
    expect(anomalies[0].severity).toBe('warning');
  });

  it('does NOT trigger anomalies on normal fee recommendations within baseline (True Negative)', async () => {
    // Normal fee oscillations within 100-150 Stroops
    for (let i = 0; i < 5; i++) {
      await agent.evaluateRecommendation({
        recommendation: makeRecommendation({ recommendedFee: 100 + i * 10 }),
      });
    }

    const anomalies = await agent.evaluateRecommendation({
      recommendation: makeRecommendation({
        recommendedFee: 140,
        ledgerCapacityUsage: 0.2,
      }),
    });

    expect(anomalies).toHaveLength(0);
  });

  it('honors configurable thresholds without code changes', async () => {
    const sensitiveAgent = new FeeEstimationDriftDetectionAgent({
      minSamplesForBaseline: 3,
      driftMultiplierThreshold: 1.5,
    });
    const tolerantAgent = new FeeEstimationDriftDetectionAgent({
      minSamplesForBaseline: 3,
      driftMultiplierThreshold: 5.0,
    });

    for (let i = 0; i < 3; i++) {
      await sensitiveAgent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 100 }) });
      await tolerantAgent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 100 }) });
    }

    // 2x jump (200 Stroops)
    const sensitiveResult = await sensitiveAgent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 200 }) });
    const tolerantResult = await tolerantAgent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 200 }) });

    expect(sensitiveResult.some((a) => a.reason === 'fee_surge_drift')).toBe(true);
    expect(tolerantResult.some((a) => a.reason === 'fee_surge_drift')).toBe(false);
  });
});
