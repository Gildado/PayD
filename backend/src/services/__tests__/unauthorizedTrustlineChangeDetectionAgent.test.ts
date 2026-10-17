import { UnauthorizedTrustlineChangeDetectionAgent } from '../unauthorizedTrustlineChangeDetectionAgent.js';

describe('UnauthorizedTrustlineChangeDetectionAgent (#1202)', () => {
  let agent: UnauthorizedTrustlineChangeDetectionAgent;
  const sampleWallet = 'GA7N6W5KE3OQ5I3EHQE22T34X4Z74D76V4O5LUS3Z6254GOPL2SVR2V7';

  beforeEach(() => {
    agent = new UnauthorizedTrustlineChangeDetectionAgent({
      approvedAssetCodes: ['USDC', 'EURC', 'XLM', 'ORGUSD'],
      requirePendingStatus: true,
      rapidChangeThreshold: 3,
      rapidChangeWindowMs: 60_000,
    });
  });

  it('detects trustlines created for unapproved asset codes (True Positive)', async () => {
    const anomalies = await agent.evaluateTrustlineChange({
      employeeId: 10,
      organizationId: 1,
      walletAddress: sampleWallet,
      assetCode: 'ROGUECOIN', // unapproved
      assetIssuer: 'GBJ7V4JHYC52O2ZNDH6WGB7E6R3YGY6YAM7G7R2EQ6V32J4K47U65C5G',
      status: 'established',
      previousStatus: 'pending',
    });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].reason).toBe('unapproved_asset_trustline');
    expect(anomalies[0].severity).toBe('critical');
    expect(anomalies[0].metadata.assetCode).toBe('ROGUECOIN');
  });

  it('detects workflow bypass when status jumps directly from none to established without pending state', async () => {
    const anomalies = await agent.evaluateTrustlineChange({
      employeeId: 10,
      organizationId: 1,
      walletAddress: sampleWallet,
      assetCode: 'USDC',
      assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      status: 'established',
      previousStatus: 'none', // Bypassed 'pending'
    });

    expect(anomalies.some((a) => a.reason === 'workflow_bypass_direct_establishment')).toBe(true);
    expect(anomalies[0].severity).toBe('warning');
  });

  it('detects rapid trustline modification churn from the same wallet', async () => {
    const now = Date.now();
    await agent.evaluateTrustlineChange({
      employeeId: 10,
      organizationId: 1,
      walletAddress: sampleWallet,
      assetCode: 'USDC',
      assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      status: 'established',
      previousStatus: 'pending',
      now,
    });

    await agent.evaluateTrustlineChange({
      employeeId: 10,
      organizationId: 1,
      walletAddress: sampleWallet,
      assetCode: 'EURC',
      assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      status: 'established',
      previousStatus: 'pending',
      now: now + 1000,
    });

    const anomalies = await agent.evaluateTrustlineChange({
      employeeId: 10,
      organizationId: 1,
      walletAddress: sampleWallet,
      assetCode: 'ORGUSD',
      assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      status: 'established',
      previousStatus: 'pending',
      now: now + 2000,
    });

    expect(anomalies.some((a) => a.reason === 'rapid_trustline_churn')).toBe(true);
    expect(anomalies.find((a) => a.reason === 'rapid_trustline_churn')?.metadata.modificationCount).toBe(3);
  });

  it('does NOT trigger anomalies on approved trustlines following standard workflow (True Negative)', async () => {
    const anomalies = await agent.evaluateTrustlineChange({
      employeeId: 15,
      organizationId: 1,
      walletAddress: 'GDIFFERENTWALLET00000000000000000000000000000000000000000000',
      assetCode: 'USDC',
      assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      status: 'established',
      previousStatus: 'pending', // Followed standard workflow
    });

    expect(anomalies).toHaveLength(0);
  });

  it('honors configurable approved asset lists without code change', async () => {
    const strictAgent = new UnauthorizedTrustlineChangeDetectionAgent({
      approvedAssetCodes: ['USDC'], // Only USDC allowed
    });

    const anomalies = await strictAgent.evaluateTrustlineChange({
      employeeId: 10,
      organizationId: 1,
      walletAddress: sampleWallet,
      assetCode: 'EURC',
      assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      status: 'established',
      previousStatus: 'pending',
    });

    expect(anomalies.some((a) => a.reason === 'unapproved_asset_trustline')).toBe(true);
  });
});
