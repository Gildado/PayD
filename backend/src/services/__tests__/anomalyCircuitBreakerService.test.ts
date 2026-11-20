import { AnomalyCircuitBreakerService, CircuitBreakerEvent } from '../anomalyCircuitBreakerService.js';

describe('AnomalyCircuitBreakerService (#1223)', () => {
  let events: CircuitBreakerEvent[];
  let service: AnomalyCircuitBreakerService;

  beforeEach(() => {
    events = [];
    service = new AnomalyCircuitBreakerService((e) => events.push(e), {
      falsePositiveRateThreshold: 0.5,
      minAlertsToEvaluate: 4,
      cooldownMs: 1000,
      windowSize: 10,
    });
  });

  it('does not disable on low false-positive rate', () => {
    // 3 true positives, 1 false positive = 25% FP rate
    for (let i = 0; i < 3; i++) service.recordAlert('agent-1', false);
    service.recordAlert('agent-1', true);

    expect(service.isEnabled('agent-1')).toBe(true);
    expect(events.filter((e) => e.action === 'disabled')).toHaveLength(0);
  });

  it('disables agent when false-positive rate exceeds threshold', () => {
    // 4 false positives = 100% FP rate
    for (let i = 0; i < 4; i++) service.recordAlert('agent-1', true);

    expect(service.isEnabled('agent-1')).toBe(false);
    const disableEvent = events.find((e) => e.action === 'disabled');
    expect(disableEvent).toBeDefined();
    expect(disableEvent!.agentId).toBe('agent-1');
    expect(disableEvent!.falsePositiveRate).toBeGreaterThanOrEqual(0.5);
  });

  it('auto-reenables after cooldown period', async () => {
    for (let i = 0; i < 4; i++) service.recordAlert('agent-1', true);
    expect(service.isEnabled('agent-1')).toBe(false);

    // Wait for cooldown (1000ms in test config)
    await new Promise((r) => setTimeout(r, 1100));
    expect(service.isEnabled('agent-1')).toBe(true);

    const reenableEvent = events.find((e) => e.action === 're-enabled');
    expect(reenableEvent).toBeDefined();
  });

  it('manual reset re-enables a disabled agent', () => {
    for (let i = 0; i < 4; i++) service.recordAlert('agent-1', true);
    expect(service.isEnabled('agent-1')).toBe(false);

    service.reset('agent-1');
    expect(service.isEnabled('agent-1')).toBe(true);

    const reenableEvent = events.find((e) => e.action === 're-enabled' && e.reason === 'Manual reset');
    expect(reenableEvent).toBeDefined();
  });

  it('does not evaluate until minimum alerts reached', () => {
    service.recordAlert('agent-1', true);
    service.recordAlert('agent-1', true);

    expect(service.isEnabled('agent-1')).toBe(true);
    expect(events).toHaveLength(0);
  });

  it('returns correct state', () => {
    service.recordAlert('agent-1', false);
    service.recordAlert('agent-1', true);

    const state = service.getState('agent-1');
    expect(state.agentId).toBe('agent-1');
    expect(state.totalAlerts).toBe(2);
    expect(state.falsePositives).toBe(1);
    expect(state.falsePositiveRate).toBe(0.5);
    expect(state.disabled).toBe(false);
  });
});
