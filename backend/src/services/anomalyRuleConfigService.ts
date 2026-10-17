/**
 * Anomaly rule configuration with per-org thresholds (#1218).
 *
 * Stores configurable detection thresholds per organization so operators
 * can tune sensitivity without code changes. Thresholds are looked up
 * by rule name and org ID, falling back to sensible defaults.
 *
 * This is the shared infrastructure that makes detection signals actionable
 * rather than noisy — each org can tune thresholds to its own risk profile.
 */

import logger from '../utils/logger.js';

export interface AnomalyRuleConfig {
  /** Rule identifier (e.g. 'large_amount', 'statistical_outlier'). */
  rule: string;
  /** Org ID these thresholds apply to. '*' means global default. */
  orgId: string;
  /** Threshold value — interpretation depends on the rule. */
  threshold: number;
  /** Whether this rule is enabled for the org. */
  enabled: boolean;
  /** When this config was last updated. */
  updatedAt: string;
}

export interface RuleConfigInput {
  rule: string;
  orgId: string;
  threshold: number;
  enabled?: boolean;
}

/** Default thresholds when no org-specific config exists. */
const DEFAULT_THRESHOLDS: Record<string, number> = {
  large_amount: 1_000_000,
  statistical_outlier: 4,
  rapid_succession: 5,
  velocity_burst: 3,
  unusual_recipient: 1,
};

/**
 * In-memory rule configuration store. In production this would back onto
 * the database; for now it provides the API surface and testability.
 */
export class AnomalyRuleConfigStore {
  private configs = new Map<string, AnomalyRuleConfig>();

  /** Set or update a rule config for an org. */
  upsert(input: RuleConfigInput): AnomalyRuleConfig {
    const key = `${input.orgId}:${input.rule}`;
    const config: AnomalyRuleConfig = {
      rule: input.rule,
      orgId: input.orgId,
      threshold: input.threshold,
      enabled: input.enabled ?? true,
      updatedAt: new Date().toISOString(),
    };
    this.configs.set(key, config);
    logger.info({ key, threshold: input.threshold }, 'Anomaly rule config updated');
    return config;
  }

  /** Get the effective threshold for a rule and org. Falls back to global default. */
  getThreshold(rule: string, orgId: string): number {
    const orgConfig = this.configs.get(`${orgId}:${rule}`);
    if (orgConfig && orgConfig.enabled) return orgConfig.threshold;
    return DEFAULT_THRESHOLDS[rule] ?? 0;
  }

  /** Check if a rule is enabled for an org. */
  isEnabled(rule: string, orgId: string): boolean {
    const orgConfig = this.configs.get(`${orgId}:${rule}`);
    return orgConfig?.enabled ?? true;
  }

  /** List all configs for an org. */
  listForOrg(orgId: string): AnomalyRuleConfig[] {
    return [...this.configs.values()].filter((c) => c.orgId === orgId);
  }

  /** Get default thresholds (for reference/documentation). */
  getDefaults(): Record<string, number> {
    return { ...DEFAULT_THRESHOLDS };
  }
}

/** Singleton store instance. */
export const ruleConfigStore = new AnomalyRuleConfigStore();
