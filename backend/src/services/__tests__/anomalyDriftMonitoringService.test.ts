import { AnomalyDriftMonitoringService, DriftEvent } from '../anomalyDriftMonitoringService.js';

describe('AnomalyDriftMonitoringService (#1221)', () => {
  let events: DriftEvent[];
  let service: AnomalyDriftMonitoringService;

  beforeEach(() => {
    events = [];
    service = new AnomalyDriftMonitoringService((e) => events.push(e), {
      windowSize: 100,
      minPrecision: 0.5,
      minRecall: 0.5,
      minSamples: 10,
      criticalPrecisionRatio: 0.5,
    });
  });

  function recordGoodSamples(agentId: string, count: number) {
    for (let i = 0; i < count; i++) {
      service.recordSample({ agentId, predicted: true, actual: true, timestamp: Date.now() });
    }
  }

  function recordBadSamples(agentId: string, count: number) {
    // False positives: predicted true, actual false
    for (let i = 0; i < count; i++) {
      service.recordSample({ agentId, predicted: true, actual: false, timestamp: Date.now() });
    }
  }

  it('does not flag drift on good performance', () => {
    recordGoodSamples('agent-1', 20);
    const metrics = service.checkAndEmitDrift('agent-1');
    expect(metrics.driftDetected).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('flags drift when precision drops below threshold', () => {
    recordGoodSamples('agent-1', 5);
    recordBadSamples('agent-1', 15); // precision = 5/20 = 0.25

    const metrics = service.checkAndEmitDrift('agent-1');
    expect(metrics.driftDetected).toBe(true);
    expect(metrics.precision).toBeLessThan(0.5);
    expect(events).toHaveLength(1);
    expect(events[0].agentId).toBe('agent-1');
  });

  it('emits critical severity when precision is very low', () => {
    recordBadSamples('agent-1', 20); // precision = 0

    const metrics = service.checkAndEmitDrift('agent-1');
    expect(metrics.driftDetected).toBe(true);
    expect(events[0].severity).toBe('critical');
  });

  it('does not evaluate before minimum samples', () => {
    recordBadSamples('agent-1', 5); // Below minSamples=10

    const metrics = service.checkAndEmitDrift('agent-1');
    expect(metrics.driftDetected).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('computes correct metrics', () => {
    recordGoodSamples('agent-1', 8); // TP=8
    recordBadSamples('agent-1', 2); // FP=2

    const metrics = service.evaluate('agent-1');
    expect(metrics.truePositives).toBe(8);
    expect(metrics.falsePositives).toBe(2);
    expect(metrics.precision).toBeCloseTo(0.8);
    expect(metrics.recall).toBe(1.0); // No false negatives
  });

  it('sliding window limits sample count', () => {
    const smallService = new AnomalyDriftMonitoringService(() => {}, { windowSize: 5, minSamples: 3 });
    recordGoodSamples.call({ recordSample: smallService.recordSample.bind(smallService) }, 'agent-1', 10);
    // Actually let me just use the service directly
    for (let i = 0; i < 10; i++) {
      smallService.recordSample({ agentId: 'agent-1', predicted: true, actual: true, timestamp: Date.now() });
    }
    const metrics = smallService.evaluate('agent-1');
    expect(metrics.windowSize).toBe(5);
  });
});
