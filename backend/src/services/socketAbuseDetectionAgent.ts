/**
 * Websocket connection abuse detection agent (#1211).
 *
 * Detects abnormal websocket connection/reconnection patterns that could
 * indicate abuse — e.g. rapid connect/disconnect cycles, excessive concurrent
 * connections from one client, or connection storms. Emits structured anomaly
 * events consumable by downstream alerting.
 *
 * Detection logic is decoupled from socketService's plumbing so it's
 * unit-testable without a database or live endpoint.
 */

import logger from '../utils/logger.js';

export type AnomalySeverity = 'warning' | 'critical';

export interface SocketConnectionEvent {
  clientId: string;
  action: 'connect' | 'disconnect' | 'error';
  timestamp: number;
  ip?: string;
  organizationId?: string;
}

export interface SocketAnomalyEvent {
  severity: AnomalySeverity;
  reason: 'rapid_reconnect' | 'connection_storm' | 'excessive_concurrent';
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type AnomalyEventHandler = (event: SocketAnomalyEvent) => void | Promise<void>;

export interface SocketDetectionOptions {
  /** Reconnects per client within the window that triggers rapid-reconnect alert. Default: 10. */
  rapidReconnectCountThreshold?: number;
  /** Window for rapid reconnect detection in ms. Default: 60_000 (1 min). */
  rapidReconnectWindowMs?: number;
  /** Total connections from all clients within the window that triggers connection storm. Default: 100. */
  connectionStormCountThreshold?: number;
  /** Window for connection storm detection in ms. Default: 10_000 (10 sec). */
  connectionStormWindowMs?: number;
  /** Maximum concurrent connections per client before alerting. Default: 5. */
  maxConcurrentPerClient?: number;
  onAnomaly?: AnomalyEventHandler;
}

const DEFAULTS = {
  rapidReconnectCountThreshold: 10,
  rapidReconnectWindowMs: 60_000,
  connectionStormCountThreshold: 100,
  connectionStormWindowMs: 10_000,
  maxConcurrentPerClient: 5,
};

interface ActivityWindow {
  timestamps: number[];
}

export class SocketAbuseDetectionAgent {
  private readonly rapidReconnectCountThreshold: number;
  private readonly rapidReconnectWindowMs: number;
  private readonly connectionStormCountThreshold: number;
  private readonly connectionStormWindowMs: number;
  private readonly maxConcurrentPerClient: number;
  private readonly onAnomaly: AnomalyEventHandler;

  /** Recent connection timestamps per client. */
  private readonly clientActivity = new Map<string, ActivityWindow>();
  /** Recent connection timestamps across all clients. */
  private readonly globalActivity: ActivityWindow = { timestamps: [] };
  /** Current concurrent connections per client. */
  private readonly concurrentConnections = new Map<string, number>();

  constructor(options: SocketDetectionOptions = {}) {
    this.rapidReconnectCountThreshold =
      options.rapidReconnectCountThreshold ?? DEFAULTS.rapidReconnectCountThreshold;
    this.rapidReconnectWindowMs =
      options.rapidReconnectWindowMs ?? DEFAULTS.rapidReconnectWindowMs;
    this.connectionStormCountThreshold =
      options.connectionStormCountThreshold ?? DEFAULTS.connectionStormCountThreshold;
    this.connectionStormWindowMs =
      options.connectionStormWindowMs ?? DEFAULTS.connectionStormWindowMs;
    this.maxConcurrentPerClient =
      options.maxConcurrentPerClient ?? DEFAULTS.maxConcurrentPerClient;
    this.onAnomaly =
      options.onAnomaly ?? ((event) => logger.warn({ event }, 'Socket abuse anomaly'));
  }

  /**
   * Evaluates one socket connection event and returns zero or more anomalies.
   */
  async evaluate(event: SocketConnectionEvent): Promise<SocketAnomalyEvent[]> {
    const anomalies: SocketAnomalyEvent[] = [];
    const now = event.timestamp;
    const detectedAt = new Date(now).toISOString();

    // Track concurrent connections
    if (event.action === 'connect') {
      const current = this.concurrentConnections.get(event.clientId) ?? 0;
      this.concurrentConnections.set(event.clientId, current + 1);

      if (current + 1 > this.maxConcurrentPerClient) {
        anomalies.push({
          severity: 'warning',
          reason: 'excessive_concurrent',
          detail: `Client ${event.clientId} has ${current + 1} concurrent connections (max ${this.maxConcurrentPerClient})`,
          detectedAt,
          metadata: {
            clientId: event.clientId,
            concurrent: current + 1,
            threshold: this.maxConcurrentPerClient,
          },
        });
      }
    } else if (event.action === 'disconnect') {
      const current = this.concurrentConnections.get(event.clientId) ?? 1;
      this.concurrentConnections.set(event.clientId, Math.max(0, current - 1));
    }

    // Rapid reconnect detection (connect events only)
    if (event.action === 'connect') {
      const window = this.clientActivity.get(event.clientId) ?? { timestamps: [] };
      window.timestamps.push(now);
      const cutoff = now - this.rapidReconnectWindowMs;
      window.timestamps = window.timestamps.filter((t) => t > cutoff);
      this.clientActivity.set(event.clientId, window);

      if (window.timestamps.length >= this.rapidReconnectCountThreshold) {
        anomalies.push({
          severity: 'critical',
          reason: 'rapid_reconnect',
          detail: `Client ${event.clientId} made ${window.timestamps.length} connections in ${this.rapidReconnectWindowMs / 1000}s`,
          detectedAt,
          metadata: {
            clientId: event.clientId,
            connectCount: window.timestamps.length,
            windowMs: this.rapidReconnectWindowMs,
            threshold: this.rapidReconnectCountThreshold,
          },
        });
      }

      // Connection storm detection (global)
      this.globalActivity.timestamps.push(now);
      const globalCutoff = now - this.connectionStormWindowMs;
      this.globalActivity.timestamps = this.globalActivity.timestamps.filter((t) => t > globalCutoff);

      if (this.globalActivity.timestamps.length >= this.connectionStormCountThreshold) {
        anomalies.push({
          severity: 'critical',
          reason: 'connection_storm',
          detail: `${this.globalActivity.timestamps.length} connections in ${this.connectionStormWindowMs / 1000}s (threshold ${this.connectionStormCountThreshold})`,
          detectedAt,
          metadata: {
            connectCount: this.globalActivity.timestamps.length,
            windowMs: this.connectionStormWindowMs,
            threshold: this.connectionStormCountThreshold,
          },
        });
      }
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }
}
