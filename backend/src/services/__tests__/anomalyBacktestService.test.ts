import { jest } from '@jest/globals';
import { BacktestHarness, type BacktestRule, type HistoricalEvent } from '../anomalyBacktestService.js';

describe('AnomalyBacktestService (#1217)', () => {
  let harness: BacktestHarness;

  beforeEach(() => {
    harness = new BacktestHarness();
  });

  const makeEvent = (overrides: Partial<HistoricalEvent> = {}): HistoricalEvent => ({
    id: 'ev-1',
    orgId: 'org-1',
    amount: 100,
    timestamp: '2025-01-01T00:00:00Z',
    isAnomaly: false,
    ...overrides,
  });

  it('computes precision and recall correctly', async () => {
    const rules: BacktestRule[] = [
      {
        rule: 'large_amount',
        threshold: 1000,
        evaluate: (e) => e.amount > 1000,
      },
    ];

    const data = [
      makeEvent({ id: 'tp', amount: 5000, isAnomaly: true }),   // true positive
      makeEvent({ id: 'fp', amount: 2000, isAnomaly: false }),  // false positive
      makeEvent({ id: 'tn', amount: 100, isAnomaly: false }),   // true negative
      makeEvent({ id: 'fn', amount: 500, isAnomaly: true }),    // false negative
    ];

    const result = await harness.run(rules, data);

    expect(result.metrics.truePositives).toBe(1);
    expect(result.metrics.falsePositives).toBe(1);
    expect(result.metrics.trueNegatives).toBe(1);
    expect(result.metrics.falseNegatives).toBe(1);
    expect(result.metrics.precision).toBe(0.5);
    expect(result.metrics.recall).toBe(0.5);
  });

  it('flags true positives and misses false negatives', async () => {
    const rules: BacktestRule[] = [
      { rule: 'r', threshold: 100, evaluate: (e) => e.amount > 100 },
    ];
    const data = [
      makeEvent({ id: 'flagged', amount: 200, isAnomaly: true }),
      makeEvent({ id: 'missed', amount: 50, isAnomaly: true }),
    ];

    const result = await harness.run(rules, data);
    expect(result.flagged.map((e) => e.id)).toContain('flagged');
    expect(result.falseNegatives.map((e) => e.id)).toContain('missed');
  });

  it('returns perfect metrics for a perfect rule', async () => {
    const rules: BacktestRule[] = [
      { rule: 'r', threshold: 100, evaluate: (e) => e.amount > 100 },
    ];
    const data = [
      makeEvent({ amount: 200, isAnomaly: true }),
      makeEvent({ amount: 50, isAnomaly: false }),
    ];

    const result = await harness.run(rules, data);
    expect(result.metrics.precision).toBe(1);
    expect(result.metrics.recall).toBe(1);
    expect(result.metrics.f1Score).toBe(1);
  });

  it('handles empty data gracefully', async () => {
    const result = await harness.run([], []);
    expect(result.metrics.truePositives).toBe(0);
    expect(result.metrics.precision).toBe(0);
  });
});
