import { ContractUpgradeDetectionAgent } from '../contractUpgradeDetectionAgent';

describe('ContractUpgradeDetectionAgent', () => {
  it('fires on execute with insufficient approvals (true positive)', async () => {
    const agent = new ContractUpgradeDetectionAgent({
      minApprovalsForExecute: 2,
    });

    const anomalies = await agent.evaluate({
      proposalId: 'prop-1',
      contractId: 'contract-abc',
      proposerAddress: 'GABC',
      approvals: ['GABC'], // Only 1 approval, needs 2
      requiredQuorum: 2,
      timestamp: Date.now(),
      action: 'execute',
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].reason).toBe('insufficient_approvals');
    expect(anomalies[0].severity).toBe('critical');
  });

  it('does not fire on execute with sufficient approvals (true negative)', async () => {
    const agent = new ContractUpgradeDetectionAgent({
      minApprovalsForExecute: 2,
    });

    const anomalies = await agent.evaluate({
      proposalId: 'prop-2',
      contractId: 'contract-abc',
      proposerAddress: 'GABC',
      approvals: ['GABC', 'GDEF'], // 2 approvals, meets minimum
      requiredQuorum: 2,
      timestamp: Date.now(),
      action: 'execute',
    });

    expect(anomalies).toHaveLength(0);
  });

  it('fires on unknown signer when whitelist is configured', async () => {
    const agent = new ContractUpgradeDetectionAgent({
      allowedSigners: ['GKNOWN1', 'GKNOWN2'],
    });

    const anomalies = await agent.evaluate({
      proposalId: 'prop-3',
      contractId: 'contract-abc',
      proposerAddress: 'GABC',
      approvals: ['GUNKNOWN'],
      requiredQuorum: 1,
      timestamp: Date.now(),
      action: 'approve',
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].reason).toBe('unknown_signer');
    expect(anomalies[0].severity).toBe('warning');
  });

  it('fires on rapid proposals (true positive)', async () => {
    const agent = new ContractUpgradeDetectionAgent({
      rapidProposalCountThreshold: 3,
      rapidProposalWindowMs: 60_000,
    });

    const now = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 3; i++) {
      const anomalies = await agent.evaluate({
        proposalId: `prop-rapid-${i}`,
        contractId: 'contract-storm',
        proposerAddress: 'GABC',
        approvals: [],
        requiredQuorum: 2,
        timestamp: now + i * 1000,
        action: 'propose',
      });
      results.push(anomalies.length);
    }

    // Third proposal should trigger the rapid-proposal alert
    expect(results[2]).toBeGreaterThan(0);
  });

  it('does not fire on spaced proposals (true negative)', async () => {
    const agent = new ContractUpgradeDetectionAgent({
      rapidProposalCountThreshold: 3,
      rapidProposalWindowMs: 60_000,
    });

    const now = Date.now();
    // Two proposals spaced far apart — should not trigger
    await agent.evaluate({
      proposalId: 'prop-a',
      contractId: 'contract-ok',
      proposerAddress: 'GABC',
      approvals: [],
      requiredQuorum: 2,
      timestamp: now,
      action: 'propose',
    });

    const anomalies = await agent.evaluate({
      proposalId: 'prop-b',
      contractId: 'contract-ok',
      proposerAddress: 'GABC',
      approvals: [],
      requiredQuorum: 2,
      timestamp: now + 120_000, // 2 minutes later, outside window
      action: 'propose',
    });

    expect(anomalies).toHaveLength(0);
  });
});
