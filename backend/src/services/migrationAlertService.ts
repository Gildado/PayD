import {
  AnomalyAlertDeliveryAgent,
  type AlertChannelConfig,
} from './anomalyAlertDeliveryAgent.js';

export interface MigrationFailureAlert {
  alert: 'MIGRATION_FAILED';
  migrationId: string;
  filename: string;
  error: string;
  severity: 'critical';
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  timestamp: string;
}

export type MigrationAlertSink = (alert: MigrationFailureAlert) => Promise<void>;

export function buildMigrationFailureAlert(
  filename: string,
  error: unknown,
  rollbackSucceeded = false,
  now: Date = new Date()
): MigrationFailureAlert {
  const summary = error instanceof Error ? error.message : String(error);
  return {
    alert: 'MIGRATION_FAILED',
    migrationId: filename,
    filename,
    error: summary.slice(0, 1000),
    severity: 'critical',
    rollbackAttempted: true,
    rollbackSucceeded,
    timestamp: now.toISOString(),
  };
}

function buildAlertChannels(): AlertChannelConfig[] {
  const channels: AlertChannelConfig[] = [];
  const slackUrl = process.env.OPS_ALERT_SLACK_WEBHOOK_URL;
  const pagerDutyUrl = process.env.OPS_ALERT_PAGERDUTY_URL;
  const pagerDutyKey = process.env.OPS_ALERT_PAGERDUTY_ROUTING_KEY;
  const emailAddress = process.env.OPS_ALERT_EMAIL;

  if (slackUrl) {
    channels.push({
      type: 'slack',
      endpoint: slackUrl,
      minSeverity: 'critical',
      maxRetries: 3,
    });
  }

  if (pagerDutyUrl && pagerDutyKey) {
    channels.push({
      type: 'pagerduty',
      endpoint: pagerDutyUrl,
      secret: pagerDutyKey,
      minSeverity: 'critical',
      maxRetries: 3,
    });
  }

  if (emailAddress) {
    channels.push({
      type: 'email',
      endpoint: emailAddress,
      minSeverity: 'critical',
      maxRetries: 1,
    });
  }

  return channels;
}

export function createMigrationAlertSink(): MigrationAlertSink {
  const channels = buildAlertChannels();

  return async (alert) => {
    if (channels.length === 0) {
      return;
    }

    const agent = new AnomalyAlertDeliveryAgent({ channels });
    await agent.deliver({
      id: `migration-failed:${alert.migrationId}:${alert.timestamp}`,
      source: 'migration-runner',
      severity: 'critical',
      title: `Migration failed: ${alert.migrationId}`,
      description: `${alert.error} (rollbackSucceeded=${alert.rollbackSucceeded})`,
      detectedAt: alert.timestamp,
      metadata: { ...alert },
    });
  };
}
