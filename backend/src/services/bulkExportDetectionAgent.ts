/**
 * Bulk data export exfiltration detection agent (#1210).
 *
 * Detects unusually large or frequent data export jobs that could indicate
 * data exfiltration — e.g. a user triggering many exports in a short window,
 * or exporting far more records than typical. Emits structured anomaly
 * events consumable by downstream alerting.
 *
 * Detection logic is decoupled from exportJobService's plumbing so it's
 * unit-testable without a database or live endpoint.
 */

import logger from '../utils/logger.js';

export type AnomalySeverity = 'warning' | 'critical';

export interface ExportJobEvent {
  jobId: string;
  userId: string;
  recordCount: number;
  exportType: 'csv' | 'json' | 'pdf' | 'xlsx';
  timestamp: number;
  organizationId?: string;
}

export interface ExportAnomalyEvent {
  severity: AnomalySeverity;
  reason: 'bulk_volume' | 'frequent_exports' | 'oversized_export';
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type AnomalyEventHandler = (event: ExportAnomalyEvent) => void | Promise<void>;

export interface ExportDetectionOptions {
  /** Record count that always triggers a bulk volume alert. Default: 10_000. */
  bulkVolumeThreshold?: number;
  /** Exports per user within the window that triggers frequent-export alert. Default: 5. */
  frequentExportCountThreshold?: number;
  /** Window for frequent export detection in ms. Default: 3_600_000 (1 hour). */
  frequentExportWindowMs?: number;
  /** Record count above which an export is considered oversized relative to typical. Default: 50_000. */
  oversizedThreshold?: number;
  onAnomaly?: AnomalyEventHandler;
}

const DEFAULTS = {
  bulkVolumeThreshold: 10_000,
  frequentExportCountThreshold: 5,
  frequentExportWindowMs: 3_600_000,
  oversizedThreshold: 50_000,
};

interface ActivityWindow {
  timestamps: number[];
  totalRecords: number;
}

export class BulkExportDetectionAgent {
  private readonly bulkVolumeThreshold: number;
  private readonly frequentExportCountThreshold: number;
  private readonly frequentExportWindowMs: number;
  private readonly oversizedThreshold: number;
  private readonly onAnomaly: AnomalyEventHandler;

  /** Recent export activity per user. */
  private readonly userActivity = new Map<string, ActivityWindow>();

  constructor(options: ExportDetectionOptions = {}) {
    this.bulkVolumeThreshold = options.bulkVolumeThreshold ?? DEFAULTS.bulkVolumeThreshold;
    this.frequentExportCountThreshold =
      options.frequentExportCountThreshold ?? DEFAULTS.frequentExportCountThreshold;
    this.frequentExportWindowMs =
      options.frequentExportWindowMs ?? DEFAULTS.frequentExportWindowMs;
    this.oversizedThreshold = options.oversizedThreshold ?? DEFAULTS.oversizedThreshold;
    this.onAnomaly =
      options.onAnomaly ?? ((event) => logger.warn({ event }, 'Bulk export anomaly'));
  }

  /**
   * Evaluates one export job event and returns zero or more anomalies.
   */
  async evaluate(event: ExportJobEvent): Promise<ExportAnomalyEvent[]> {
    const anomalies: ExportAnomalyEvent[] = [];
    const now = event.timestamp;
    const detectedAt = new Date(now).toISOString();

    // Bulk volume detection — absolute threshold
    if (event.recordCount >= this.bulkVolumeThreshold) {
      anomalies.push({
        severity: 'critical',
        reason: 'bulk_volume',
        detail: `Export job ${event.jobId} contains ${event.recordCount} records (threshold ${this.bulkVolumeThreshold})`,
        detectedAt,
        metadata: {
          jobId: event.jobId,
          userId: event.userId,
          recordCount: event.recordCount,
          exportType: event.exportType,
          threshold: this.bulkVolumeThreshold,
        },
      });
    }

    // Oversized export — far beyond typical
    if (event.recordCount >= this.oversizedThreshold && event.recordCount < this.bulkVolumeThreshold) {
      anomalies.push({
        severity: 'warning',
        reason: 'oversized_export',
        detail: `Export job ${event.jobId} contains ${event.recordCount} records (oversized threshold ${this.oversizedThreshold})`,
        detectedAt,
        metadata: {
          jobId: event.jobId,
          userId: event.userId,
          recordCount: event.recordCount,
          exportType: event.exportType,
          threshold: this.oversizedThreshold,
        },
      });
    }

    // Frequent exports detection
    const window = this.userActivity.get(event.userId) ?? { timestamps: [], totalRecords: 0 };
    window.timestamps.push(now);
    window.totalRecords += event.recordCount;

    const cutoff = now - this.frequentExportWindowMs;
    window.timestamps = window.timestamps.filter((t) => t > cutoff);
    this.userActivity.set(event.userId, window);

    if (window.timestamps.length >= this.frequentExportCountThreshold) {
      anomalies.push({
        severity: 'warning',
        reason: 'frequent_exports',
        detail: `User ${event.userId} triggered ${window.timestamps.length} exports in ${this.frequentExportWindowMs / 1000}s (total ${window.totalRecords} records)`,
        detectedAt,
        metadata: {
          userId: event.userId,
          exportCount: window.timestamps.length,
          totalRecords: window.totalRecords,
          windowMs: this.frequentExportWindowMs,
          threshold: this.frequentExportCountThreshold,
        },
      });
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }
}
