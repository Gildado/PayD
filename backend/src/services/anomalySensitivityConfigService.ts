/**
 * Per-tenant anomaly sensitivity configuration (#1222).
 *
 * Each organization can tune detection thresholds independently so a
 * high-volume org isn't drowned in false positives while a low-volume org
 * isn't under-alerted. Configuration is stored in the database and can be
 * changed without a code change or redeploy.
 */

export interface AnomalySensitivityConfig {
  organizationId: number;
  /** Multiplier applied to all detection thresholds. 1.0 = default, <1 = more sensitive. */
  sensitivityMultiplier: number;
  /** Minimum severity level to emit alerts for this tenant. */
  minSeverity: 'info' | 'warning' | 'critical';
  /** Per-agent overrides, keyed by agent ID. */
  agentOverrides: Record<string, AgentSensitivityOverride>;
  /** Whether anomaly detection is enabled for this tenant. */
  enabled: boolean;
  updatedAt: string;
}

export interface AgentSensitivityOverride {
  /** Override the sensitivity multiplier for this specific agent. */
  sensitivityMultiplier?: number;
  /** Disable this specific agent for this tenant. */
  disabled?: boolean;
}

const DEFAULT_CONFIG: Omit<AnomalySensitivityConfig, 'organizationId' | 'updatedAt'> = {
  sensitivityMultiplier: 1.0,
  minSeverity: 'info',
  agentOverrides: {},
  enabled: true,
};

export class AnomalySensitivityConfigService {
  private configs: Map<number, AnomalySensitivityConfig>;

  constructor() {
    this.configs = new Map();
  }

  /** Get the effective config for an organization, falling back to defaults. */
  getConfig(organizationId: number): AnomalySensitivityConfig {
    return (
      this.configs.get(organizationId) ?? {
        organizationId,
        ...DEFAULT_CONFIG,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  /** Create or update an organization's sensitivity config. */
  setConfig(
    organizationId: number,
    updates: Partial<Omit<AnomalySensitivityConfig, 'organizationId' | 'updatedAt'>>,
  ): AnomalySensitivityConfig {
    const existing = this.getConfig(organizationId);
    const merged: AnomalySensitivityConfig = {
      ...existing,
      ...updates,
      organizationId,
      updatedAt: new Date().toISOString(),
    };
    this.configs.set(organizationId, merged);
    return merged;
  }

  /** Get the effective sensitivity multiplier for a specific agent under a tenant. */
  getEffectiveMultiplier(organizationId: number, agentId: string): number {
    const config = this.getConfig(organizationId);
    const override = config.agentOverrides[agentId];
    return override?.sensitivityMultiplier ?? config.sensitivityMultiplier;
  }

  /** Check if an agent is active for a tenant. */
  isAgentEnabled(organizationId: number, agentId: string): boolean {
    const config = this.getConfig(organizationId);
    if (!config.enabled) return false;
    const override = config.agentOverrides[agentId];
    return !override?.disabled;
  }

  /** Check if a severity level meets the tenant's minimum threshold. */
  shouldEmit(organizationId: number, severity: 'info' | 'warning' | 'critical'): boolean {
    const config = this.getConfig(organizationId);
    const levels = { info: 0, warning: 1, critical: 2 };
    return levels[severity] >= levels[config.minSeverity];
  }
}
