#!/usr/bin/env node
/**
 * Executable verification script for Issue #1202:
 * Unauthorized Trustline Change Detection Agent.
 */

import { UnauthorizedTrustlineChangeDetectionAgent } from '../src/services/unauthorizedTrustlineChangeDetectionAgent.ts';
import assert from 'node:assert/strict';

async function main() {
  console.log('===============================================================');
  console.log('PAYD: UNAUTHORIZED TRUSTLINE DETECTION AGENT (#1202)');
  console.log('===============================================================');

  const agent = new UnauthorizedTrustlineChangeDetectionAgent({
    approvedAssetCodes: ['USDC', 'EURC', 'XLM', 'PAYD'],
    approvedIssuers: ['GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'],
    rapidChangeThreshold: 3,
    rapidChangeWindowMs: 5000,
  });

  const baseParams = {
    employeeId: 42,
    organizationId: 10,
    walletAddress: 'GBBM6WDFVIUOYDDJRBCQH6GBINHNSH56Y3KLNSDB6STZ2G25RWVIKZM8',
    assetCode: 'USDC',
    assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    status: 'established',
    previousStatus: 'pending',
  };

  // Test 1: True Positive - Unapproved Asset Code
  console.log('\n[1/5] Testing True Positive: Unapproved Asset Code...');
  const unapprovedCodeAnomalies = await agent.evaluateTrustlineChange({
    ...baseParams,
    assetCode: 'SCAMCOIN',
  });
  assert.ok(unapprovedCodeAnomalies.some((a) => a.reason === 'unapproved_asset_trustline'));
  assert.equal(unapprovedCodeAnomalies[0].severity, 'critical');
  console.log('  ✓ Successfully caught unapproved asset code "SCAMCOIN"');

  // Test 2: True Positive - Unapproved Asset Issuer
  console.log('\n[2/5] Testing True Positive: Unapproved Issuer Key...');
  const unapprovedIssuerAnomalies = await agent.evaluateTrustlineChange({
    ...baseParams,
    assetCode: 'USDC',
    assetIssuer: 'GBMALICIOUSISSUERPUBLICKEY1234567890ABCDEFGHJKLMNPQRSTUVWXYZ',
  });
  assert.ok(unapprovedIssuerAnomalies.some((a) => a.reason === 'unapproved_asset_issuer'));
  assert.equal(unapprovedIssuerAnomalies[0].severity, 'critical');
  console.log('  ✓ Successfully caught unapproved asset issuer address');

  // Test 3: True Positive - Workflow Bypass (none -> established without pending)
  console.log('\n[3/5] Testing True Positive: Workflow Bypass...');
  const bypassAnomalies = await agent.evaluateTrustlineChange({
    ...baseParams,
    previousStatus: 'none',
    status: 'established',
  });
  assert.ok(bypassAnomalies.some((a) => a.reason === 'workflow_bypass_direct_establishment'));
  assert.equal(bypassAnomalies[0].severity, 'warning');
  console.log('  ✓ Successfully caught workflow bypass (none -> established)');

  // Test 4: True Positive - Rapid Modification Churn
  console.log('\n[4/5] Testing True Positive: Rapid Trustline Churn...');
  agent.resetActivity();
  const churningWallet = 'GDRAPIDCHURNWALLETADDRESS1234567890ABCDEFGHJKLMNPQ';
  await agent.evaluateTrustlineChange({ ...baseParams, walletAddress: churningWallet });
  await agent.evaluateTrustlineChange({ ...baseParams, walletAddress: churningWallet });
  const churnAnomalies = await agent.evaluateTrustlineChange({
    ...baseParams,
    walletAddress: churningWallet,
  });
  assert.ok(churnAnomalies.some((a) => a.reason === 'rapid_trustline_churn'));
  console.log('  ✓ Successfully caught rapid trustline modifications');

  // Test 5: True Negative - Standard Authorized Trustline
  console.log('\n[5/5] Testing True Negative: Standard Authorized Trustline...');
  agent.resetActivity();
  const cleanAnomalies = await agent.evaluateTrustlineChange({
    ...baseParams,
    assetCode: 'USDC',
    assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    previousStatus: 'pending',
    status: 'established',
  });
  assert.equal(cleanAnomalies.length, 0);
  console.log('  ✓ No false positives on legitimate workflow trustlines');

  console.log('\n===============================================================');
  console.log('ALL UNAUTHORIZED TRUSTLINE DETECTION TESTS PASSED! (#1202)');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
