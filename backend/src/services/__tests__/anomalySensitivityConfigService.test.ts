import { AnomalySensitivityConfigService } from '../anomalySensitivityConfigService.js';

describe('AnomalySensitivityConfigService (#1222)', () => {
  let service: AnomalySensitivityConfigService;

  beforeEach(() => {
    service = new AnomalySensitivityConfigService();
  });

  it('returns default config for unknown organization', () => {
    const config = service.getConfig(1);
    expect(config.sensitivityMultiplier).toBe(1.0);
    expect(config.minSeverity).toBe('info');
    expect(config.enabled).toBe(true);
  });

  it('stores and retrieves per-tenant config', () => {
    service.setConfig(1, { sensitivityMultiplier: 0.5, minSeverity: 'warning' });
    const config = service.getConfig(1);
    expect(config.sensitivityMultiplier).toBe(0.5);
    expect(config.minSeverity).toBe('warning');
  });

  it('applies agent-specific overrides', () => {
    service.setConfig(1, {
      sensitivityMultiplier: 1.0,
      agentOverrides: { 'agent-a': { sensitivityMultiplier: 2.0 } },
    });

    expect(service.getEffectiveMultiplier(1, 'agent-a')).toBe(2.0);
    expect(service.getEffectiveMultiplier(1, 'agent-b')).toBe(1.0);
  });

  it('respects agent disable override', () => {
    service.setConfig(1, {
      agentOverrides: { 'agent-a': { disabled: true } },
    });

    expect(service.isAgentEnabled(1, 'agent-a')).toBe(false);
    expect(service.isAgentEnabled(1, 'agent-b')).toBe(true);
  });

  it('respects tenant-level disable', () => {
    service.setConfig(1, { enabled: false });
    expect(service.isAgentEnabled(1, 'agent-a')).toBe(false);
  });

  it('filters by min severity', () => {
    service.setConfig(1, { minSeverity: 'warning' });

    expect(service.shouldEmit(1, 'info')).toBe(false);
    expect(service.shouldEmit(1, 'warning')).toBe(true);
    expect(service.shouldEmit(1, 'critical')).toBe(true);
  });
});
