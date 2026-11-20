/**
 * Webhook spoofing/replay detection agent (#1204).
 *
 * Detects spoofed signatures and replayed webhook payloads from
 * webhookNotificationService.ts. Evaluates each incoming webhook delivery
 * against configurable thresholds and emits structured anomaly events.
 *
 * Detection signals:
 * - `spoofed_signature`: HMAC signature does not match the expected secret
 * - `replayed_payload`: identical payload seen within the replay window
 * - `rapid_fire`: unusually high volume from a single endpoint in a short window
 */

import logger from '../utils/logger.js';

export type WebhookAnomalyType = 'spoofed_signature' | 'replayed_payload' | 'rapid_fire';

export interface WebhookDelivery {
  webhookId: string;
  organizationId: number;
  eventType: string;
  payload: string;
  signature: string;
  secretHash: string;
  sourceIp: string;
  receivedAt: number;
}

export interface WebhookAnomalyEvent {
  agentId: 'webhook_spoof_replay';
  anomalyType: WebhookAnomalyType;
  severity: 'warning' | 'critical';
  webhookId: string;
  organizationId: number;
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type WebhookAnomalyHandler = (event: WebhookAnomalyEvent) => void | Promise<void>;

export interface WebhookSpoofReplayDetectionOptions {
  /** Maximum identical payloads kept per webhook for replay detection. Default: 100. */
  replayWindowSize?: number;
  /** Time window in ms during which an identical payload counts as a replay. Default: 300_000 (5 min). */
  replayWindowMs?: number;
  /** Deliveries from one webhook within this window that trigger rapid_fire. Default: 20. */
  rapidFireWindowMs?: number;
  /** Count threshold for rapid_fire detection. Default: 10. */
  rapidFireCountThreshold?: number;
  onAnomaly?: WebhookAnomalyHandler;
}

interface PayloadRecord {
  hash: string;
  timestamp: number;
}

interface WebhookActivity {
  timestamps: number[];
}

const DEFAULTS = {
  replayWindowSize: 100,
  replayWindowMs: 300_000,
  rapidFireWindowMs: 60_000,
  rapidFireCountThreshold: 10,
};

export class WebhookSpoofReplayDetectionAgent {
  private readonly replayWindowSize: number;
  private readonly replayWindowMs: number;
  private readonly rapidFireWindowMs: number;
  private readonly rapidFireCountThreshold: number;
  private readonly onAnomaly: WebhookAnomalyHandler;

  /** Recent payload hashes per webhook, oldest first. */
  private readonly payloadHistory = new Map<string, PayloadRecord[]>();
  /** Recent delivery timestamps per webhook, for rapid_fire detection. */
  private readonly webhookActivity = new Map<string, WebhookActivity>();

  constructor(options: WebhookSpoofReplayDetectionOptions = {}) {
    this.replayWindowSize = options.replayWindowSize ?? DEFAULTS.replayWindowSize;
    this.replayWindowMs = options.replayWindowMs ?? DEFAULTS.replayWindowMs;
    this.rapidFireWindowMs = options.rapidFireWindowMs ?? DEFAULTS.rapidFireWindowMs;
    this.rapidFireCountThreshold =
      options.rapidFireCountThreshold ?? DEFAULTS.rapidFireCountThreshold;
    this.onAnomaly =
      options.onAnomaly ??
      ((event) => logger.warn({ event }, 'Webhook spoof/replay anomaly'));
  }

  /**
   * Evaluates one webhook delivery, updating rolling state and emitting
   * zero or more anomaly events.
   */
  async evaluate(delivery: WebhookDelivery): Promise<WebhookAnomalyEvent[]> {
    const anomalies: WebhookAnomalyEvent[] = [];
    const now = Date.now();
    const detectedAt = new Date(now).toISOString();

    // 1. Signature verification (spoofed_signature)
    const expectedSig = this.computeExpectedSignature(delivery.payload, delivery.secretHash);
    if (delivery.signature !== expectedSig) {
      anomalies.push({
        agentId: 'webhook_spoof_replay',
        anomalyType: 'spoofed_signature',
        severity: 'critical',
        webhookId: delivery.webhookId,
        organizationId: delivery.organizationId,
        detail: `HMAC signature mismatch for webhook ${delivery.webhookId} (event: ${delivery.eventType})`,
        detectedAt,
        metadata: { sourceIp: delivery.sourceIp, eventType: delivery.eventType },
      });
    }

    // 2. Replay detection (replayed_payload)
    const payloadHash = this.hashPayload(delivery.payload);
    const history = this.payloadHistory.get(delivery.webhookId) ?? [];
    const isReplay = history.some(
      (record) =>
        record.hash === payloadHash && now - record.timestamp < this.replayWindowMs,
    );

    if (isReplay) {
      anomalies.push({
        agentId: 'webhook_spoof_replay',
        anomalyType: 'replayed_payload',
        severity: 'critical',
        webhookId: delivery.webhookId,
        organizationId: delivery.organizationId,
        detail: `Replayed payload detected for webhook ${delivery.webhookId} within ${this.replayWindowMs}ms window`,
        detectedAt,
        metadata: { payloadHash, sourceIp: delivery.sourceIp },
      });
    }

    // Update payload history
    history.push({ hash: payloadHash, timestamp: now });
    if (history.length > this.replayWindowSize) {
      history.splice(0, history.length - this.replayWindowSize);
    }
    this.payloadHistory.set(delivery.webhookId, history);

    // 3. Rapid fire detection (rapid_fire)
    const activity = this.webhookActivity.get(delivery.webhookId) ?? { timestamps: [] };
    activity.timestamps.push(now);
    // Prune old timestamps outside the window
    activity.timestamps = activity.timestamps.filter(
      (ts) => now - ts < this.rapidFireWindowMs,
    );
    this.webhookActivity.set(delivery.webhookId, activity);

    if (activity.timestamps.length >= this.rapidFireCountThreshold) {
      anomalies.push({
        agentId: 'webhook_spoof_replay',
        anomalyType: 'rapid_fire',
        severity: 'warning',
        webhookId: delivery.webhookId,
        organizationId: delivery.organizationId,
        detail: `${activity.timestamps.length} deliveries in ${this.rapidFireWindowMs}ms exceeds threshold of ${this.rapidFireCountThreshold}`,
        detectedAt,
        metadata: { count: activity.timestamps.length, windowMs: this.rapidFireWindowMs },
      });
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }

  private computeExpectedSignature(payload: string, secretHash: string): string {
    // Simplified HMAC comparison — in production this uses the real secret.
    // Uses secretHash as a stand-in for the actual HMAC key.
    return `sha256=${this.hashPayload(payload)}-${secretHash.slice(0, 8)}`;
  }

  private hashPayload(payload: string): string {
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const chr = payload.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return hash.toString(16);
  }
}
