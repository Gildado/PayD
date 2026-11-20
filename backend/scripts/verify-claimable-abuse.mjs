#!/usr/bin/env node
/**
 * Executable verification script for Issue #1203:
 * Claimable Balance Abuse Detection Agent.
 */

import { ClaimableBalanceAbuseDetectionAgent } from '../src/services/claimableBalanceAbuseDetectionAgent.ts';
import assert from 'node:assert/strict';

async function main() {
  console.log('===============================================================');
  console.log('PAYD: CLAIMABLE BALANCE ABUSE DETECTION AGENT (#1203)');
  console.log('===============================================================');

  const agent = new ClaimableBalanceAbuseDetectionAgent({
    dustAmountThreshold: 0.001,
    criticalAmountThreshold: 50_000,
    maxCreationsPerWindow: 4,
    burstWindowMs: 5000,
    minValidExpirationDays: 1,
  });

  const baseInput = {
    organization_id: 99,
    employee_id: 12,
    amount: '1500.00',
    asset_code: 'USDC',
    claimant_public_key: 'GDEMPLOYEECLAIMANTPUBLICKEY1234567890ABCDEFGHJKLMNPQRST',
    expires_in_days: 30,
  };

  // Test 1: True Positive - Dust Balance Spam
  console.log('\n[1/5] Testing True Positive: Micro / Dust Spam Balance...');
  const dustAnomalies = await agent.evaluateBalanceCreation({
    input: { ...baseInput, amount: '0.000001' },
    balanceId: 'bal-dust-1',
  });
  assert.ok(dustAnomalies.some((a) => a.reason === 'dust_balance_spam'));
  assert.equal(dustAnomalies[0].severity, 'warning');
  console.log('  ✓ Successfully caught micro/dust claimable balance spam (0.000001 USDC)');

  // Test 2: True Positive - Critical High-Value Outlier
  console.log('\n[2/5] Testing True Positive: High-Value Amount Outlier...');
  const outlierAnomalies = await agent.evaluateBalanceCreation({
    input: { ...baseInput, amount: '120000.00' },
    balanceId: 'bal-outlier-1',
  });
  assert.ok(outlierAnomalies.some((a) => a.reason === 'excessive_amount_outlier'));
  assert.equal(outlierAnomalies[0].severity, 'critical');
  console.log('  ✓ Successfully caught excessive amount outlier (120,000.00 USDC)');

  // Test 3: True Positive - Abnormal Expiration Window
  console.log('\n[3/5] Testing True Positive: Abnormal Expiration Window...');
  const expireAnomalies = await agent.evaluateBalanceCreation({
    input: { ...baseInput, expires_in_days: 0 },
    balanceId: 'bal-expire-0',
  });
  assert.ok(expireAnomalies.some((a) => a.reason === 'abnormal_expiration_window'));
  assert.equal(expireAnomalies[0].severity, 'warning');
  console.log('  ✓ Successfully caught abnormally short expiration window (0 days)');

  // Test 4: True Positive - Rapid Creation Burst Flooding
  console.log('\n[4/5] Testing True Positive: Rapid Creation Burst...');
  agent.resetActivity();
  for (let i = 0; i < 3; i++) {
    await agent.evaluateBalanceCreation({
      input: { ...baseInput, organization_id: 777 },
      balanceId: `burst-${i}`,
    });
  }
  const burstAnomalies = await agent.evaluateBalanceCreation({
    input: { ...baseInput, organization_id: 777 },
    balanceId: 'burst-4',
  });
  assert.ok(burstAnomalies.some((a) => a.reason === 'creation_burst_flood'));
  console.log('  ✓ Successfully caught rapid creation burst (4 balances in burst window)');

  // Test 5: True Negative - Standard Legitimate Payroll Balance
  console.log('\n[5/5] Testing True Negative: Standard Legitimate Payroll Balance...');
  agent.resetActivity();
  const legitimateAnomalies = await agent.evaluateBalanceCreation({
    input: {
      organization_id: 1,
      employee_id: 10,
      amount: '2500.00',
      asset_code: 'USDC',
      claimant_public_key: 'GDEMPLOYEECLAIMANTPUBLICKEY1234567890ABCDEFGHJKLMNPQRST',
      expires_in_days: 14,
    },
    balanceId: 'bal-legit-1',
  });
  assert.equal(legitimateAnomalies.length, 0);
  console.log('  ✓ No false positives on legitimate payroll claimable balance');

  console.log('\n===============================================================');
  console.log('ALL CLAIMABLE BALANCE ABUSE DETECTION TESTS PASSED! (#1203)');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
