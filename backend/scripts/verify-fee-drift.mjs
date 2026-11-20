#!/usr/bin/env node
/**
 * Executable verification script for Issue #1201:
 * Fee Estimation Drift Detection Agent.
 */

import { FeeEstimationDriftDetectionAgent } from '../src/services/feeEstimationDriftDetectionAgent.ts';
import assert from 'node:assert/strict';

function makeRecommendation(overrides = {}) {
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

async function main() {
  console.log('===============================================================');
  console.log('PAYD: FEE ESTIMATION DRIFT DETECTION AGENT (#1201)');
  console.log('===============================================================');

  const agent = new FeeEstimationDriftDetectionAgent({
    minSamplesForBaseline: 5,
    driftMultiplierThreshold: 3.0,
    maxAllowedFeeStroops: 10_000,
  });

  // Test 1: True Positive - Fee Spike Drift
  console.log('\n[1/4] Testing True Positive: Fee Surge Drift from Baseline...');
  for (let i = 0; i < 5; i++) {
    await agent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 100 }) });
  }
  // Sudden spike to 500 Stroops (5x baseline)
  const driftAnomalies = await agent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 500 }) });
  assert.ok(driftAnomalies.some(a => a.reason === 'fee_surge_drift'));
  assert.equal(driftAnomalies[0].severity, 'warning');
  assert.ok(driftAnomalies[0].metadata.driftRatio >= 3.0);
  console.log('  ✓ Successfully detected fee surge drift from rolling baseline');

  // Test 2: True Positive - Critical Absolute Fee Surge
  console.log('\n[2/4] Testing True Positive: Absolute Fee Surge Ceiling...');
  const surgeAnomalies = await agent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 15_000 }) });
  assert.ok(surgeAnomalies.some(a => a.reason === 'absolute_fee_surge'));
  assert.equal(surgeAnomalies[0].severity, 'critical');
  console.log('  ✓ Successfully caught absolute fee surge above 10,000 Stroops');

  // Test 3: True Positive - Inversion Under High Congestion
  console.log('\n[3/4] Testing True Positive: Fee Inversion Under Heavy Congestion...');
  const inversionAnomalies = await agent.evaluateRecommendation({
    recommendation: makeRecommendation({
      recommendedFee: 100,
      baseFee: 100,
      ledgerCapacityUsage: 0.95,
      congestionLevel: 'high',
    }),
  });
  assert.ok(inversionAnomalies.some(a => a.reason === 'congestion_underestimation_inversion'));
  console.log('  ✓ Successfully caught underestimation inversion during 95% capacity saturation');

  // Test 4: True Negative - Stable Normal Fee Recommendations
  console.log('\n[4/4] Testing True Negative: Stable Normal Fee Recommendations...');
  agent.resetRollingWindow();
  for (let i = 0; i < 5; i++) {
    await agent.evaluateRecommendation({ recommendation: makeRecommendation({ recommendedFee: 100 + i * 5 }) });
  }
  const cleanAnomalies = await agent.evaluateRecommendation({
    recommendation: makeRecommendation({ recommendedFee: 120, ledgerCapacityUsage: 0.2 }),
  });
  assert.equal(cleanAnomalies.length, 0);
  console.log('  ✓ No false positives on normal fee fluctuations');

  console.log('\n===============================================================');
  console.log('ALL FEE ESTIMATION DRIFT DETECTION TESTS PASSED! (#1201)');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
