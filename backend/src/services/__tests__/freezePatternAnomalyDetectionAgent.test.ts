import { FreezePatternAnomalyDetectionAgent } from '../freezePatternAnomalyDetectionAgent.js';
import type { FreezeLogRecord } from '../freezeService.js';

const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const HOUR_MS = 3_600_000;

function makeLog(overrides: Partial<FreezeLogRecord> = {}): FreezeLogRecord {
  return {
    id: 1,
    target_account: 'GACCOUNTA',
    asset_code: 'USDC',
    asset_issuer: 'GISSUER',
    action: 'freeze',
    scope: 'account',
    tx_hash: null,
    initiated_by: 'GADMIN',
    reason: null,
    created_at: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

describe('FreezePatternAnomalyDetectionAgent (#1196)', () => {
  let agent: FreezePatternAnomalyDetectionAgent;

  beforeEach(() => {
    agent = new FreezePatternAnomalyDetectionAgent({
      windowMs: HOUR_MS,
      maxActionsPerAccountPerWindow: 5,
      maxAccountsPerAssetPerWindow: 3,
    });
  });

  it('detects repeated freeze/unfreeze toggling on one account (True Positive)', async () => {
    const logs = Array.from({ length: 5 }, (_, i) =>
      makeLog({ id: i + 1, action: i % 2 === 0 ? 'freeze' : 'unfreeze' })
    );

    const anomalies = await agent.evaluateLogs({ logs, now: NOW });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].reason).toBe('freeze_action_frequency_spike');
    expect(anomalies[0].severity).toBe('warning');
    expect(anomalies[0].metadata.actionCount).toBe(5);
  });

  it('detects freezes clustered across accounts for one asset (True Positive)', async () => {
    const logs = ['GACCOUNTA', 'GACCOUNTB', 'GACCOUNTC'].map((account, i) =>
      makeLog({ id: i + 1, target_account: account })
    );

    const anomalies = await agent.evaluateLogs({ logs, now: NOW });

    expect(anomalies.some((a) => a.reason === 'freeze_account_clustering')).toBe(true);
    expect(anomalies.find((a) => a.reason === 'freeze_account_clustering')?.severity).toBe(
      'critical'
    );
  });

  it('does not fire for spaced-out actions outside the window (True Negative)', async () => {
    const logs = [
      makeLog({ id: 1, created_at: new Date(NOW - 3 * HOUR_MS).toISOString() }),
      makeLog({ id: 2, action: 'unfreeze', created_at: new Date(NOW - 2 * HOUR_MS).toISOString() }),
      makeLog({ id: 3, target_account: 'GACCOUNTB' }),
    ];

    const anomalies = await agent.evaluateLogs({ logs, now: NOW });

    expect(anomalies).toHaveLength(0);
  });
});
