import { jest } from '@jest/globals';
import { AnomalyRuleConfigStore } from '../anomalyRuleConfigService.js';

describe('AnomalyRuleConfigService (#1218)', () => {
  let store: AnomalyRuleConfigStore;

  beforeEach(() => {
    store = new AnomalyRuleConfigStore();
  });

  it('returns default threshold when no org config exists', () => {
    expect(store.getThreshold('large_amount', 'org-1')).toBe(1_000_000);
  });

  it('returns org-specific threshold when configured', () => {
    store.upsert({ rule: 'large_amount', orgId: 'org-1', threshold: 500 });
    expect(store.getThreshold('large_amount', 'org-1')).toBe(500);
  });

  it('falls back to default for unconfigured orgs', () => {
    store.upsert({ rule: 'large_amount', orgId: 'org-1', threshold: 500 });
    expect(store.getThreshold('large_amount', 'org-2')).toBe(1_000_000);
  });

  it('respects enabled=false', () => {
    store.upsert({ rule: 'large_amount', orgId: 'org-1', threshold: 500, enabled: false });
    expect(store.isEnabled('large_amount', 'org-1')).toBe(false);
    expect(store.getThreshold('large_amount', 'org-1')).toBe(1_000_000); // falls back
  });

  it('lists configs for an org', () => {
    store.upsert({ rule: 'large_amount', orgId: 'org-1', threshold: 500 });
    store.upsert({ rule: 'rapid_succession', orgId: 'org-1', threshold: 3 });
    const configs = store.listForOrg('org-1');
    expect(configs).toHaveLength(2);
  });
});
