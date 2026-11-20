/**
 * Anomaly detection infrastructure (#1224–#1227).
 *
 * Shared types and services used by detection agents so raw signals become
 * actionable: golden-dataset regression hooks, alert deduplication,
 * agent SLA/latency stats, and cross-agent correlation.
 */

export type AnomalySeverity = 'info' | 'warning' | 'critical';

/** Structured anomaly event consumable by downstream alerting. */
export interface AnomalyEvent {
  id: string;
  agentId: string;
  rule: string;
  severity: AnomalySeverity;
  subject: string;
  /** Free-form signal payload the agent measured. */
  details: Record<string, unknown>;
  observedAt: string;
  /** Fingerprint used for deduplication (agentId + rule + subject). */
  fingerprint: string;
}

export function makeFingerprint(agentId: string, rule: string, subject: string): string {
  return `${agentId}|${rule}|${subject}`;
}

export function makeAnomalyEvent(input: {
  id: string;
  agentId: string;
  rule: string;
  severity: AnomalySeverity;
  subject: string;
  details?: Record<string, unknown>;
  observedAt?: string;
}): AnomalyEvent {
  return {
    id: input.id,
    agentId: input.agentId,
    rule: input.rule,
    severity: input.severity,
    subject: input.subject,
    details: input.details ?? {},
    observedAt: input.observedAt ?? new Date().toISOString(),
    fingerprint: makeFingerprint(input.agentId, input.rule, input.subject),
  };
}

/**
 * Alert deduplication (#1225).
 *
 * Suppresses repeats of the same fingerprint inside a TTL window so a noisy
 * agent cannot flood alerting. Thresholds are options, not code changes.
 */
export class AnomalyDeduplicator {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly ttlMs = Number(process.env.ANOMALY_DEDUP_TTL_MS ?? 15 * 60 * 1000),
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true when this event should be delivered (not a recent duplicate). */
  shouldDeliver(event: Pick<AnomalyEvent, 'fingerprint'>): boolean {
    const key = event.fingerprint;
    const ts = this.now();
    const last = this.seen.get(key);
    if (last !== undefined && ts - last < this.ttlMs) {
      return false;
    }
    this.seen.set(key, ts);
    this.prune(ts);
    return true;
  }

  private prune(ts: number): void {
    for (const [key, seenAt] of this.seen) {
      if (ts - seenAt >= this.ttlMs) this.seen.delete(key);
    }
  }
}

/** Per-agent latency/SLA sample (#1226). */
export interface AgentLatencySample {
  agentId: string;
  durationMs: number;
  ok: boolean;
  at: number;
}

export interface AgentSlaStats {
  agentId: string;
  count: number;
  errorCount: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  /** True when errorRate <= maxErrorRate and p95Ms <= maxP95Ms. */
  withinSla: boolean;
}

export interface SlaThresholds {
  maxErrorRate: number;
  maxP95Ms: number;
}

/**
 * Rolling SLA/latency monitor for anomaly agents (#1226).
 * Feeds the dashboard API; window size and SLA targets are configurable.
 */
export class AgentSlaMonitor {
  private readonly samples = new Map<string, AgentLatencySample[]>();

  constructor(
    private readonly maxSamples = Number(process.env.ANOMALY_SLA_WINDOW ?? 500),
    private readonly thresholds: SlaThresholds = {
      maxErrorRate: Number(process.env.ANOMALY_SLA_MAX_ERROR_RATE ?? 0.05),
      maxP95Ms: Number(process.env.ANOMALY_SLA_MAX_P95_MS ?? 5000),
    },
    private readonly now: () => number = Date.now,
  ) {}

  record(agentId: string, durationMs: number, ok = true): void {
    const list = this.samples.get(agentId) ?? [];
    list.push({ agentId, durationMs, ok, at: this.now() });
    if (list.length > this.maxSamples) list.splice(0, list.length - this.maxSamples);
    this.samples.set(agentId, list);
  }

  stats(agentId: string): AgentSlaStats {
    const list = this.samples.get(agentId) ?? [];
    const durations = list.map((s) => s.durationMs).sort((a, b) => a - b);
    const errorCount = list.filter((s) => !s.ok).length;
    const errorRate = list.length === 0 ? 0 : errorCount / list.length;
    const pick = (p: number) =>
      durations.length === 0 ? 0 : durations[Math.min(durations.length - 1, Math.floor(p * durations.length))];
    const p95Ms = pick(0.95);
    return {
      agentId,
      count: list.length,
      errorCount,
      errorRate,
      p50Ms: pick(0.5),
      p95Ms,
      p99Ms: pick(0.99),
      maxMs: durations.length ? durations[durations.length - 1] : 0,
      withinSla: errorRate <= this.thresholds.maxErrorRate && p95Ms <= this.thresholds.maxP95Ms,
    };
  }

  allStats(): AgentSlaStats[] {
    return [...this.samples.keys()].map((id) => this.stats(id));
  }
}

/**
 * Cross-agent anomaly correlation (#1227).
 *
 * Fuses signals from multiple agents on the same subject inside a time
 * window into a higher-confidence correlated anomaly.
 */
export interface CorrelationResult {
  subject: string;
  agentIds: string[];
  eventIds: string[];
  /** Max severity among fused events. */
  severity: AnomalySeverity;
  correlatedAt: string;
  reason: string;
}

const SEVERITY_RANK: Record<AnomalySeverity, number> = { info: 0, warning: 1, critical: 2 };

export class AnomalyCorrelator {
  private readonly window: AnomalyEvent[] = [];

  constructor(
    private readonly windowMs = Number(process.env.ANOMALY_CORRELATION_WINDOW_MS ?? 10 * 60 * 1000),
    private readonly minAgents = Number(process.env.ANOMALY_CORRELATION_MIN_AGENTS ?? 2),
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Add an event. When `minAgents` distinct agents reported on the same
   * subject within the window, returns a correlated result.
   */
  ingest(event: AnomalyEvent): CorrelationResult | null {
    const ts = this.now();
    this.window.push(event);
    while (this.window.length && ts - Date.parse(this.window[0].observedAt) > this.windowMs) {
      this.window.shift();
    }
    const related = this.window.filter((e) => e.subject === event.subject);
    const agentIds = [...new Set(related.map((e) => e.agentId))];
    if (agentIds.length < this.minAgents) return null;
    let severity: AnomalySeverity = 'info';
    for (const e of related) {
      if (SEVERITY_RANK[e.severity] > SEVERITY_RANK[severity]) severity = e.severity;
    }
    return {
      subject: event.subject,
      agentIds,
      eventIds: related.map((e) => e.id),
      severity,
      correlatedAt: new Date(ts).toISOString(),
      reason: `Correlated signals from ${agentIds.length} agents on subject`,
    };
  }
}
