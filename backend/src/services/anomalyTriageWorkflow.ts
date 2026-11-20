/**
 * Anomaly severity scoring & triage workflow (#1214).
 *
 * Takes raw anomaly events from detection agents and assigns a composite
 * severity score (0-100) based on multiple factors: base severity,
 * frequency, affected scope, and historical false-positive rate.
 * Produces a triage priority queue for operators.
 */

import logger from '../utils/logger.js';

export type TriagePriority = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyEvent {
  id: string;
  source: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SeverityScore {
  /** Composite score 0-100. */
  score: number;
  priority: TriagePriority;
  /** Breakdown of contributing factors. */
  factors: {
    baseSeverity: number;
    frequencyBoost: number;
    scopeBoost: number;
    falsePositivePenalty: number;
  };
  rationale: string;
}

export interface TriageEntry {
  anomaly: AnomalyEvent;
  score: SeverityScore;
  triagedAt: string;
  assignedTo?: string;
  status: 'pending' | 'triaged' | 'resolved' | 'false_positive';
}

export interface TriageWorkflowOptions {
  /** Weights for score components (must sum to 1). */
  weights?: {
    baseSeverity: number;
    frequency: number;
    scope: number;
  };
  /** How many recent anomalies per source to consider for frequency scoring. */
  frequencyWindowSize?: number;
  /** Score threshold for 'critical' priority. Default: 80. */
  criticalThreshold?: number;
  /** Score threshold for 'high' priority. Default: 60. */
  highThreshold?: number;
  /** Score threshold for 'medium' priority. Default: 30. */
  mediumThreshold?: number;
}

const DEFAULTS = {
  weights: { baseSeverity: 0.5, frequency: 0.3, scope: 0.2 },
  frequencyWindowSize: 50,
  criticalThreshold: 80,
  highThreshold: 60,
  mediumThreshold: 30,
};

const BASE_SEVERITY_SCORES = { info: 20, warning: 50, critical: 80 };

export class AnomalyTriageWorkflow {
  private readonly weights: { baseSeverity: number; frequency: number; scope: number };
  private readonly frequencyWindowSize: number;
  private readonly criticalThreshold: number;
  private readonly highThreshold: number;
  private readonly mediumThreshold: number;

  private readonly recentBySource = new Map<string, number>();
  private readonly falsePositiveRates = new Map<string, { total: number; falsePositives: number }>();
  private readonly queue: TriageEntry[] = [];

  constructor(options: TriageWorkflowOptions = {}) {
    this.weights = options.weights ?? DEFAULTS.weights;
    this.frequencyWindowSize = options.frequencyWindowSize ?? DEFAULTS.frequencyWindowSize;
    this.criticalThreshold = options.criticalThreshold ?? DEFAULTS.criticalThreshold;
    this.highThreshold = options.highThreshold ?? DEFAULTS.highThreshold;
    this.mediumThreshold = options.mediumThreshold ?? DEFAULTS.mediumThreshold;
  }

  /**
   * Score an anomaly and add it to the triage queue.
   */
  scoreAndEnqueue(anomaly: AnomalyEvent): TriageEntry {
    const score = this.score(anomaly);
    const entry: TriageEntry = {
      anomaly,
      score,
      triagedAt: new Date().toISOString(),
      status: 'pending',
    };
    this.queue.push(entry);
    return entry;
  }

  /**
   * Compute a composite severity score for an anomaly.
   */
  score(anomaly: AnomalyEvent): SeverityScore {
    // Base severity (0-100)
    const baseSeverity = BASE_SEVERITY_SCORES[anomaly.severity] ?? 50;

    // Frequency boost: more anomalies from the same source = higher score
    const sourceCount = (this.recentBySource.get(anomaly.source) ?? 0) + 1;
    this.recentBySource.set(anomaly.source, sourceCount);
    const frequencyBoost = Math.min(sourceCount * 5, 40);

    // Scope boost: anomalies affecting more entities are more urgent
    const scope = anomaly.metadata?.affectedCount ?? anomaly.metadata?.scopeSize ?? 1;
    const scopeBoost = Math.min(Number(scope) * 3, 20);

    // False-positive penalty: if this source has high FP rate, reduce score
    const fpStats = this.falsePositiveRates.get(anomaly.source);
    const falsePositivePenalty = fpStats && fpStats.total > 0
      ? Math.min((fpStats.falsePositives / fpStats.total) * 30, 30)
      : 0;

    const score = Math.round(
      baseSeverity * this.weights.baseSeverity +
      frequencyBoost * this.weights.frequency +
      (scopeBoost - falsePositivePenalty) * this.weights.scope,
    );

    const clampedScore = Math.max(0, Math.min(100, score));
    const priority = this.priority(clampedScore);

    return {
      score: clampedScore,
      priority,
      factors: { baseSeverity, frequencyBoost, scopeBoost, falsePositivePenalty },
      rationale: `base=${baseSeverity} freq=${frequencyBoost} scope=${scopeBoost} fp_penalty=${falsePositivePenalty} → ${clampedScore} (${priority})`,
    };
  }

  private priority(score: number): TriagePriority {
    if (score >= this.criticalThreshold) return 'critical';
    if (score >= this.highThreshold) return 'high';
    if (score >= this.mediumThreshold) return 'medium';
    return 'low';
  }

  /**
   * Get the triage queue sorted by priority (highest first).
   */
  getQueue(status?: TriageEntry['status']): TriageEntry[] {
    let items = this.queue;
    if (status) {
      items = items.filter((e) => e.status === status);
    }
    return [...items].sort((a, b) => b.score.score - a.score.score);
  }

  /**
   * Mark an entry as resolved or false_positive. Updates FP rates for the source.
   */
  resolve(id: string, status: 'resolved' | 'false_positive', assignee?: string): void {
    const entry = this.queue.find((e) => e.anomaly.id === id);
    if (!entry) return;

    entry.status = status;
    if (assignee) entry.assignedTo = assignee;

    const source = entry.anomaly.source;
    const stats = this.falsePositiveRates.get(source) ?? { total: 0, falsePositives: 0 };
    stats.total++;
    if (status === 'false_positive') stats.falsePositives++;
    this.falsePositiveRates.set(source, stats);
  }

  reset(): void {
    this.recentBySource.clear();
    this.falsePositiveRates.clear();
    this.queue.length = 0;
  }
}
