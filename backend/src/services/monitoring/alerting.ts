import logger from '../logging/logger';
import { monitoringConfig } from '../../config/monitoring';
import metricsCollector from './metrics';

/**
 * Alerting Service
 *
 * Monitors error rates and performance thresholds, triggering alerts
 * when configured limits are exceeded. Supports:
 * - Console/log-based alerts (always on)
 * - Email alerts via SMTP (when configured)
 * - Cooldown periods to prevent alert storms
 */

export interface Alert {
  id: string;
  type: 'error_rate' | 'response_time' | 'service_down' | 'custom';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
}

class AlertingService {
  private alerts: Alert[] = [];
  private lastAlertTime: Map<string, number> = new Map();
  private readonly maxAlerts = 1000;
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start the periodic alerting check.
   */
  start(): void {
    // Check every 30 seconds
    this.checkInterval = setInterval(() => this.runChecks(), 30_000);
    this.checkInterval.unref();

    logger.info('Alerting service started', {
      type: 'alerting',
      errorRateThreshold: monitoringConfig.ERROR_RATE_THRESHOLD,
      responseTimeThresholdMs: monitoringConfig.RESPONSE_TIME_THRESHOLD_MS,
      cooldownMs: monitoringConfig.ALERT_COOLDOWN_MS,
    });
  }

  /**
   * Stop the periodic alerting check.
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Run all configured alert checks.
   */
  private runChecks(): void {
    this.checkErrorRate();
    this.checkResponseTime();
  }

  /**
   * Check if the error rate exceeds the configured threshold.
   */
  private checkErrorRate(): void {
    const errorRate = metricsCollector.getErrorRate();

    if (errorRate >= monitoringConfig.ERROR_RATE_THRESHOLD) {
      this.createAlert({
        type: 'error_rate',
        severity: errorRate >= monitoringConfig.ERROR_RATE_THRESHOLD * 2 ? 'critical' : 'warning',
        title: 'High Error Rate Detected',
        message: `Error rate is ${errorRate} errors/min (threshold: ${monitoringConfig.ERROR_RATE_THRESHOLD}/min)`,
        metadata: { errorRate, threshold: monitoringConfig.ERROR_RATE_THRESHOLD },
      });
    }
  }

  /**
   * Check if average response time exceeds the configured threshold.
   */
  private checkResponseTime(): void {
    const summary = metricsCollector.getSummary();

    if (
      summary.requests.total > 0 &&
      summary.requests.p95DurationMs > monitoringConfig.RESPONSE_TIME_THRESHOLD_MS
    ) {
      this.createAlert({
        type: 'response_time',
        severity: 'warning',
        title: 'Slow Response Times Detected',
        message: `P95 response time is ${summary.requests.p95DurationMs}ms (threshold: ${monitoringConfig.RESPONSE_TIME_THRESHOLD_MS}ms)`,
        metadata: {
          p95: summary.requests.p95DurationMs,
          p99: summary.requests.p99DurationMs,
          avg: summary.requests.averageDurationMs,
          threshold: monitoringConfig.RESPONSE_TIME_THRESHOLD_MS,
        },
      });
    }
  }

  /**
   * Create and store an alert, respecting cooldown periods.
   */
  createAlert(params: {
    type: Alert['type'];
    severity: Alert['severity'];
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Alert | null {
    const alertKey = `${params.type}:${params.severity}`;
    const lastTime = this.lastAlertTime.get(alertKey);
    const now = Date.now();

    // Enforce cooldown
    if (lastTime && now - lastTime < monitoringConfig.ALERT_COOLDOWN_MS) {
      return null;
    }

    const alert: Alert = {
      id: `alert-${now}-${Math.random().toString(36).substring(2, 8)}`,
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      timestamp: new Date(),
      metadata: params.metadata || {},
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.lastAlertTime.set(alertKey, now);

    // Trim old alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts / 2);
    }

    // Log the alert
    const logLevel = params.severity === 'critical' ? 'error' : 'warn';
    logger.log(logLevel, `ALERT: ${params.title}`, {
      type: 'alert',
      alertId: alert.id,
      alertType: params.type,
      severity: params.severity,
      ...params.metadata,
    });

    // Send email if configured
    if (monitoringConfig.ALERT_EMAIL_ENABLED) {
      this.sendEmailAlert(alert).catch((err) => {
        logger.error('Failed to send alert email', { error: (err as Error).message });
      });
    }

    return alert;
  }

  /**
   * Send an alert via SMTP email.
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    // Use dynamic import so nodemailer is only loaded when email alerting is enabled
    try {
      const nodemailer = await import('nodemailer');

      const transporter = nodemailer.createTransport({
        host: monitoringConfig.SMTP_HOST,
        port: monitoringConfig.SMTP_PORT,
        secure: monitoringConfig.SMTP_PORT === 465,
        auth: {
          user: monitoringConfig.SMTP_USER,
          pass: monitoringConfig.SMTP_PASS,
        },
      });

      const severityColor =
        alert.severity === 'critical' ? '#dc3545' : alert.severity === 'warning' ? '#ffc107' : '#17a2b8';

      await transporter.sendMail({
        from: monitoringConfig.ALERT_EMAIL_FROM,
        to: monitoringConfig.ALERT_EMAIL_TO,
        subject: `[PayD ${alert.severity.toUpperCase()}] ${alert.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${severityColor}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">${alert.title}</h2>
              <small>${alert.severity.toUpperCase()} — ${alert.timestamp.toISOString()}</small>
            </div>
            <div style="padding: 16px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
              <p>${alert.message}</p>
              <h4>Details</h4>
              <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(alert.metadata, null, 2)}</pre>
              <hr>
              <small style="color: #888;">Alert ID: ${alert.id} | Service: ${monitoringConfig.SERVICE_NAME}</small>
            </div>
          </div>
        `,
      });

      logger.info('Alert email sent', {
        type: 'alerting',
        alertId: alert.id,
        to: monitoringConfig.ALERT_EMAIL_TO,
      });
    } catch (error) {
      logger.error('Failed to send alert email', {
        type: 'alerting',
        alertId: alert.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get all alerts, optionally filtered.
   */
  getAlerts(filter?: {
    severity?: Alert['severity'];
    type?: Alert['type'];
    acknowledged?: boolean;
    limit?: number;
  }): Alert[] {
    let result = [...this.alerts];

    if (filter?.severity) {
      result = result.filter((a) => a.severity === filter.severity);
    }
    if (filter?.type) {
      result = result.filter((a) => a.type === filter.type);
    }
    if (filter?.acknowledged !== undefined) {
      result = result.filter((a) => a.acknowledged === filter.acknowledged);
    }

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return result.slice(0, filter?.limit || 50);
  }

  /**
   * Acknowledge an alert by ID.
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }
}

export const alertingService = new AlertingService();
export default alertingService;
