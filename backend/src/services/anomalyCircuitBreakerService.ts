/**
 * Anomaly agent auto-disable circuit breaker (#1223).
 *
 * Automatically disables a detection agent when its false-positive rate
 * exceeds a configurable threshold over a sliding window, preventing alert
 * fatigue from a noisy agent. The agent is re-enabled after a cooldown
 * period or manual reset.
 */

export interface CircuitBreakerConfig {
  /** False-positive rate (0–1) above which the agent is disabled. Default: 0.8. */
  falsePositiveRateThreshold: number;
  /** Minimum number of alerts before the rate is evaluated. Default: 10. */
  minAlertsToEvaluate: number;
  /** Cooldown period in ms before auto-reenable. Default: 3600_000 (1 hour). */
  cooldownMs: number;
  /** Sliding window size (number of recent alerts). Default: 50. */
  windowSize: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  falsePositiveRateThreshold: 0.8,
  minAlertsToEvaluate: 10,
  cooldownMs: 3_600_000,
  windowSize: 50,
};

export interface CircuitBreakerState {
  agentId: string;
  disabled: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  falsePositiveRate: number;
  totalAlerts: number;
  falsePositives: number;
  cooldownEndsAt: string | null;
}

export interface CircuitBreakerEvent {
  agentId: string;
  action: 'disabled' | 're-enabled';
  reason: string;
  falsePositiveRate: number;
  triggeredAt: string;
}

export type CircuitBreakerEventHandler = (event: CircuitBreakerEvent) => void;

interface AgentWindow {
  alerts: boolean[]; // true = false positive, false = true positive
  disabled: boolean;
  disabledAt: number | null;
  disabledReason: string | null;
}

export class AnomalyCircuitBreakerService {
  private agents: Map<string, AgentWindow>;
  private config: CircuitBreakerConfig;
  private onEvent: CircuitBreakerEventHandler;

  constructor(onEvent: CircuitBreakerEventHandler, config: Partial<CircuitBreakerConfig> = {}) {
    this.agents = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onEvent = onEvent;
  }

  /**
   * Record an alert outcome. `isFalsePositive` = true if the alert was a
   * false alarm (no real anomaly), false if it was a true positive.
   */
  recordAlert(agentId: string, isFalsePositive: boolean): void {
    const window = this.agents.get(agentId) ?? {
      alerts: [],
      disabled: false,
      disabledAt: null,
      disabledReason: null,
    };

    window.alerts.push(isFalsePositive);
    if (window.alerts.length > this.config.windowSize) {
      window.alerts.splice(0, window.alerts.length - this.config.windowSize);
    }

    // Auto-disable check.
    if (!window.disabled && window.alerts.length >= this.config.minAlertsToEvaluate) {
      const fpCount = window.alerts.filter((a) => a).length;
      const fpRate = fpCount / window.alerts.length;

      if (fpRate >= this.config.falsePositiveRateThreshold) {
        window.disabled = true;
        window.disabledAt = Date.now();
        window.disabledReason = `False-positive rate ${fpRate.toFixed(2)} exceeded threshold ${this.config.falsePositiveRateThreshold}`;

        this.onEvent({
          agentId,
          action: 'disabled',
          reason: window.disabledReason,
          falsePositiveRate: fpRate,
          triggeredAt: new Date().toISOString(),
        });
      }
    }

    this.agents.set(agentId, window);
  }

  /** Check if an agent is currently disabled. Auto-reenables after cooldown. */
  isEnabled(agentId: string): boolean {
    const window = this.agents.get(agentId);
    if (!window) return true;

    if (window.disabled && window.disabledAt !== null) {
      const cooldownEnd = window.disabledAt + this.config.cooldownMs;
      if (Date.now() >= cooldownEnd) {
        // Auto-reenable after cooldown.
        window.disabled = false;
        window.disabledAt = null;
        window.disabledReason = null;
        window.alerts = []; // Reset window for fresh evaluation.

        this.onEvent({
          agentId,
          action: 're-enabled',
          reason: 'Cooldown period elapsed',
          falsePositiveRate: 0,
          triggeredAt: new Date().toISOString(),
        });
      }
    }

    return !window.disabled;
  }

  /** Manually re-enable a disabled agent. */
  reset(agentId: string): void {
    const window = this.agents.get(agentId);
    if (window && window.disabled) {
      window.disabled = false;
      window.disabledAt = null;
      window.disabledReason = null;
      window.alerts = [];

      this.onEvent({
        agentId,
        action: 're-enabled',
        reason: 'Manual reset',
        falsePositiveRate: 0,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  /** Get current state for an agent. */
  getState(agentId: string): CircuitBreakerState {
    const window = this.agents.get(agentId);
    if (!window) {
      return {
        agentId,
        disabled: false,
        disabledAt: null,
        disabledReason: null,
        falsePositiveRate: 0,
        totalAlerts: 0,
        falsePositives: 0,
        cooldownEndsAt: null,
      };
    }

    const fpCount = window.alerts.filter((a) => a).length;
    return {
      agentId,
      disabled: window.disabled,
      disabledAt: window.disabledAt ? new Date(window.disabledAt).toISOString() : null,
      disabledReason: window.disabledReason,
      falsePositiveRate: window.alerts.length > 0 ? fpCount / window.alerts.length : 0,
      totalAlerts: window.alerts.length,
      falsePositives: fpCount,
      cooldownEndsAt:
        window.disabled && window.disabledAt !== null
          ? new Date(window.disabledAt + this.config.cooldownMs).toISOString()
          : null,
    };
  }

  /** Get states for all tracked agents. */
  getAllStates(): CircuitBreakerState[] {
    return Array.from(this.agents.keys()).map((id) => this.getState(id));
  }
}
