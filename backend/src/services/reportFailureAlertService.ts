/**
 * Report agent failure alerting service (#1338).
 *
 * Wraps report generation with:
 *  - failure tracking (consecutive failures per report)
 *  - alerting via a pluggable handler once a threshold is crossed
 *  - graceful degradation: on failure the result carries an explicit
 *    `manual-export-fallback` instruction so callers can fall back to the
 *    manual export entry point instead of erroring out.
 *
 * See docs/REPORT_AGENT.md for the documented output schema.
 */

import logger from '../utils/logger.js';

export type AlertSeverity = 'warning' | 'critical';

export interface FailureAlertContext {
  reportId: string;
  organizationId?: string | number;
}

export interface FailureAlert {
  severity: AlertSeverity;
  reportId: string;
  organizationId?: string | number;
  message: string;
  consecutiveFailures: number;
  triggeredAt: string;
}

export type AlertHandler = (alert: FailureAlert) => void | Promise<void>;

export interface ManualExportFallback {
  action: 'manual-export';
  /** UI route where the operator can run the manual export flow. */
  entryPoint: string;
  instructions: string;
}

export type ReportExecutionResult<T> =
  | { ok: true; source: 'agent'; report: T }
  | {
      ok: false;
      source: 'manual-export-fallback';
      error: { message: string };
      alert: FailureAlert | null;
      fallback: ManualExportFallback;
    };

export interface ReportFailureAlertServiceOptions {
  /** Consecutive failures required to raise an alert (default 2). */
  alertThreshold?: number;
  /** Pluggable alert sink (webhook, notification service, ...). */
  onAlert?: AlertHandler;
}

const DEFAULT_ALERT_THRESHOLD = 2;

export class ReportFailureAlertService {
  private readonly alertThreshold: number;
  private readonly onAlert: AlertHandler;
  private readonly consecutiveFailures = new Map<string, number>();

  constructor(options: ReportFailureAlertServiceOptions = {}) {
    this.alertThreshold = Math.max(1, options.alertThreshold ?? DEFAULT_ALERT_THRESHOLD);
    this.onAlert =
      options.onAlert ??
      ((alert) => logger.warn({ alert }, 'Report agent failure alert'));
  }

  /**
   * Runs `task`; on success resets the failure counter and returns the report.
   * On error, records the failure, raises an alert when the threshold is met,
   * and returns a structured manual-export fallback result instead of throwing.
   */
  async executeWithFallback<T>(
    task: () => Promise<T>,
    context: FailureAlertContext
  ): Promise<ReportExecutionResult<T>> {
    try {
      const report = await task();
      this.consecutiveFailures.delete(this.key(context));
      return { ok: true, source: 'agent', report };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown report generation error';
      const count = this.recordFailure(context);
      let alert: FailureAlert | null = null;
      if (count >= this.alertThreshold) {
        alert = {
          severity: count >= this.alertThreshold * 2 ? 'critical' : 'warning',
          reportId: context.reportId,
          organizationId: context.organizationId,
          message,
          consecutiveFailures: count,
          triggeredAt: new Date().toISOString(),
        };
        await this.onAlert(alert);
      }
      return {
        ok: false,
        source: 'manual-export-fallback',
        error: { message },
        alert,
        fallback: {
          action: 'manual-export',
          entryPoint: '/reports/custom',
          instructions:
            'The automated report agent failed. Use the Custom Payroll Export Builder to generate the export manually.',
        },
      };
    }
  }

  /** Consecutive failure count for one report (or all reports). */
  getFailureSummary(context?: FailureAlertContext): Record<string, number> {
    if (context) {
      const key = this.key(context);
      return this.consecutiveFailures.has(key)
        ? { [key]: this.consecutiveFailures.get(key)! }
        : {};
    }
    return Object.fromEntries(this.consecutiveFailures);
  }

  reset(): void {
    this.consecutiveFailures.clear();
  }

  private recordFailure(context: FailureAlertContext): number {
    const key = this.key(context);
    const next = (this.consecutiveFailures.get(key) ?? 0) + 1;
    this.consecutiveFailures.set(key, next);
    return next;
  }

  private key(context: FailureAlertContext): string {
    return context.organizationId !== undefined
      ? `${context.reportId}:${context.organizationId}`
      : context.reportId;
  }
}

export const reportFailureAlertService = new ReportFailureAlertService();
