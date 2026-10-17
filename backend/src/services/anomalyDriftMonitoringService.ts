/**
 * Anomaly agent model evaluation & drift monitoring (#1221).
 *
 * Tracks each detection agent's precision/recall over a sliding window and
 * emits a structured drift event when performance degrades beyond a
 * configurable threshold. Downstream alerting subscribes to the drift
 * event to surface model degradation before it becomes a blind spot.
 */

export interface AgentEvaluationSample {
  agentId: string;
  predicted: boolean; // agent flagged this sample as anomalous
  actual: boolean; // ground truth: was it actually anomalous?
  timestamp: number;
}

export interface DriftMetrics {
  agentId: string;
  windowSize: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  driftDetected: boolean;
  driftReason?: string;
}

export interface DriftEvent {
  agentId: string;
  metrics: DriftMetrics;
  triggeredAt: string;
  severity: 'warning' | 'critical';
}

export interface DriftMonitoringConfig {
  /** Sliding window size (number of samples). Default: 200. */
  windowSize: number;
  /** Minimum precision before drift is flagged. Default: 0.5. */
  minPrecision: number;
  /** Minimum recall before drift is flagged. Default: 0.5. */
  minRecall: number;
  /** Minimum samples before evaluation kicks in. Default: 20. */
  minSamples: number;
  /** Severity when precision drops below half the threshold. */
  criticalPrecisionRatio: number;
}

const DEFAULT_CONFIG: DriftMonitoringConfig = {
  windowSize: 200,
  minPrecision: 0.5,
  minRecall: 0.5,
  minSamples: 20,
  criticalPrecisionRatio: 0.5,
};

export type DriftEventHandler = (event: DriftEvent) => void;

export class AnomalyDriftMonitoringService {
  private samples: Map<string, AgentEvaluationSample[]>;
  private config: DriftMonitoringConfig;
  private onDrift: DriftEventHandler;

  constructor(onDrift: DriftEventHandler, config: Partial<DriftMonitoringConfig> = {}) {
    this.samples = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onDrift = onDrift;
  }

  /** Record a labeled evaluation sample for an agent. */
  recordSample(sample: AgentEvaluationSample): void {
    const list = this.samples.get(sample.agentId) ?? [];
    list.push(sample);
    // Keep only the sliding window.
    if (list.length > this.config.windowSize) {
      list.splice(0, list.length - this.config.windowSize);
    }
    this.samples.set(sample.agentId, list);
  }

  /** Compute current drift metrics for an agent without emitting an event. */
  evaluate(agentId: string): DriftMetrics {
    const list = this.samples.get(agentId) ?? [];
    let tp = 0, fp = 0, tn = 0, fn = 0;

    for (const s of list) {
      if (s.predicted && s.actual) tp++;
      else if (s.predicted && !s.actual) fp++;
      else if (!s.predicted && !s.actual) tn++;
      else fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    let driftDetected = false;
    let driftReason: string | undefined;

    if (list.length >= this.config.minSamples) {
      if (precision < this.config.minPrecision) {
        driftDetected = true;
        driftReason = `Precision ${precision.toFixed(2)} below threshold ${this.config.minPrecision}`;
      } else if (recall < this.config.minRecall) {
        driftDetected = true;
        driftReason = `Recall ${recall.toFixed(2)} below threshold ${this.config.minRecall}`;
      }
    }

    return {
      agentId,
      windowSize: list.length,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      precision,
      recall,
      f1Score: f1,
      driftDetected,
      driftReason,
    };
  }

  /** Evaluate and emit a drift event if performance has degraded. */
  checkAndEmitDrift(agentId: string): DriftMetrics {
    const metrics = this.evaluate(agentId);

    if (metrics.driftDetected) {
      const severity: DriftEvent['severity'] =
        metrics.precision < this.config.minPrecision * this.config.criticalPrecisionRatio
          ? 'critical'
          : 'warning';

      this.onDrift({
        agentId,
        metrics,
        triggeredAt: new Date().toISOString(),
        severity,
      });
    }

    return metrics;
  }

  /** Get metrics for all tracked agents. */
  evaluateAll(): DriftMetrics[] {
    return Array.from(this.samples.keys()).map((id) => this.evaluate(id));
  }
}
