import {
  AnomalyCorrelator,
  AnomalyDeduplicator,
  AgentSlaMonitor,
  makeAnomalyEvent,
} from '../anomalyInfrastructure';

describe('AnomalyDeduplicator (#1225)', () => {
  it('true positive: delivers first signal, suppresses duplicate fingerprint in TTL', () => {
    let now = 1_000;
    const dedupe = new AnomalyDeduplicator(60_000, () => now);
    const ev = makeAnomalyEvent({
      id: '1',
      agentId: 'fund-agent',
      rule: 'large_amount',
      subject: 'contract:A',
    });
    expect(dedupe.shouldDeliver(ev)).toBe(true);
    expect(dedupe.shouldDeliver({ ...ev, id: '2' })).toBe(false);
    now += 61_000;
    expect(dedupe.shouldDeliver({ ...ev, id: '3' })).toBe(true);
  });

  it('true negative: different fingerprints are not suppressed', () => {
    const dedupe = new AnomalyDeduplicator(60_000, () => 1_000);
    expect(dedupe.shouldDeliver(makeAnomalyEvent({ id: '1', agentId: 'a', rule: 'r', subject: 's1' }))).toBe(true);
    expect(dedupe.shouldDeliver(makeAnomalyEvent({ id: '2', agentId: 'a', rule: 'r', subject: 's2' }))).toBe(true);
  });
});

describe('AgentSlaMonitor (#1226)', () => {
  it('true positive: reports withinSla=false when error rate exceeds threshold', () => {
    const mon = new AgentSlaMonitor(100, { maxErrorRate: 0.1, maxP95Ms: 1000 }, () => 0);
    for (let i = 0; i < 10; i++) mon.record('agent-x', 10, i < 5); // 50% errors
    const stats = mon.stats('agent-x');
    expect(stats.withinSla).toBe(false);
    expect(stats.errorRate).toBeCloseTo(0.5);
  });

  it('true negative: healthy agent stays within SLA', () => {
    const mon = new AgentSlaMonitor(100, { maxErrorRate: 0.1, maxP95Ms: 1000 }, () => 0);
    for (let i = 0; i < 10; i++) mon.record('agent-y', 20, true);
    expect(mon.stats('agent-y').withinSla).toBe(true);
  });
});

describe('AnomalyCorrelator (#1227)', () => {
  it('true positive: fuses signals from two agents on the same subject', () => {
    let now = 1_000;
    const corr = new AnomalyCorrelator(60_000, 2, () => now);
    expect(
      corr.ingest(makeAnomalyEvent({ id: '1', agentId: 'a1', rule: 'r', subject: 'wallet:Z', severity: 'warning' })),
    ).toBeNull();
    const fused = corr.ingest(
      makeAnomalyEvent({ id: '2', agentId: 'a2', rule: 'r2', subject: 'wallet:Z', severity: 'critical' }),
    );
    expect(fused).not.toBeNull();
    expect(fused!.agentIds.sort()).toEqual(['a1', 'a2']);
    expect(fused!.severity).toBe('critical');
  });

  it('true negative: single agent never correlates', () => {
    const corr = new AnomalyCorrelator(60_000, 2, () => 1_000);
    expect(
      corr.ingest(makeAnomalyEvent({ id: '1', agentId: 'only', rule: 'r', subject: 's' })),
    ).toBeNull();
    expect(
      corr.ingest(makeAnomalyEvent({ id: '2', agentId: 'only', rule: 'r', subject: 's' })),
    ).toBeNull();
  });
});
