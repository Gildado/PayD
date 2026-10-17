import { ClaimableBalanceAbuseDetectionAgent } from '../claimableBalanceAbuseDetectionAgent.js';
import type { CreateClaimableBalanceInput } from '../claimableBalanceService.js';

function makeClaimableBalanceInput(overrides: Partial<CreateClaimableBalanceInput> = {}): CreateClaimableBalanceInput {
  return {
    organization_id: 1,
    employee_id: 101,
    claimant_public_key: 'GA7N6W5KE3OQ5I3EHQE22T34X4Z74D76V4O5LUS3Z6254GOPL2SVR2V7',
    amount: '1500.00',
    asset_code: 'USDC',
    asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    sponsor_keypair: {} as any,
    expires_in_days: 7,
    ...overrides,
  };
}

describe('ClaimableBalanceAbuseDetectionAgent (#1203)', () => {
  let agent: ClaimableBalanceAbuseDetectionAgent;

  beforeEach(() => {
    agent = new ClaimableBalanceAbuseDetectionAgent({
      dustAmountThreshold: 0.001,
      criticalAmountThreshold: 50_000,
      maxCreationsPerWindow: 3,
      burstWindowMs: 60_000,
      minValidExpirationDays: 1,
    });
  });

  it('detects micro / dust balance spam attack (True Positive)', async () => {
    const input = makeClaimableBalanceInput({ amount: '0.0001' }); // < 0.001
    const anomalies = await agent.evaluateBalanceCreation({ input, balanceId: 'bal-dust-1' });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].reason).toBe('dust_balance_spam');
    expect(anomalies[0].severity).toBe('warning');
    expect(anomalies[0].metadata.amount).toBe('0.0001');
  });

  it('detects high-value balance amount outlier (True Positive)', async () => {
    const input = makeClaimableBalanceInput({ amount: '250000.00' }); // > 50,000
    const anomalies = await agent.evaluateBalanceCreation({ input, balanceId: 'bal-huge-1' });

    expect(anomalies.some((a) => a.reason === 'excessive_amount_outlier')).toBe(true);
    expect(anomalies[0].severity).toBe('critical');
  });

  it('detects abnormally short expiration windows', async () => {
    const input = makeClaimableBalanceInput({ expires_in_days: 0.01 }); // less than 1 day
    const anomalies = await agent.evaluateBalanceCreation({ input, balanceId: 'bal-short-exp' });

    expect(anomalies.some((a) => a.reason === 'abnormal_expiration_window')).toBe(true);
    expect(anomalies[0].metadata.expiresInDays).toBe(0.01);
  });

  it('detects rapid creation burst / flood attacks from same organization', async () => {
    const now = Date.now();
    await agent.evaluateBalanceCreation({ input: makeClaimableBalanceInput(), now });
    await agent.evaluateBalanceCreation({ input: makeClaimableBalanceInput(), now: now + 500 });
    const anomalies = await agent.evaluateBalanceCreation({ input: makeClaimableBalanceInput(), now: now + 1000 });

    expect(anomalies.some((a) => a.reason === 'creation_burst_flood')).toBe(true);
    expect(anomalies.find((a) => a.reason === 'creation_burst_flood')?.metadata.creationsCount).toBe(3);
  });

  it('does NOT trigger anomalies on normal legitimate payroll claimable balance (True Negative)', async () => {
    const input = makeClaimableBalanceInput({
      amount: '2500.00',
      expires_in_days: 14,
    });
    const anomalies = await agent.evaluateBalanceCreation({ input, balanceId: 'bal-legit-1' });

    expect(anomalies).toHaveLength(0);
  });

  it('honors configurable thresholds without code changes', async () => {
    const tolerantAgent = new ClaimableBalanceAbuseDetectionAgent({
      criticalAmountThreshold: 500_000,
    });

    const input = makeClaimableBalanceInput({ amount: '100000.00' });
    const anomalies = await tolerantAgent.evaluateBalanceCreation({ input });

    expect(anomalies.some((a) => a.reason === 'excessive_amount_outlier')).toBe(false);
  });
});
