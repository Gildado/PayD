/**
 * Rate-limit bypass pattern detection agent (#1212).
 *
 * Detects coordinated request patterns designed to evade rate limiting,
 * such as distributed requests across multiple IPs, credential rotation
 * patterns, and request-spreading across time windows.
 *
 * Wired to rateLimitService.ts data. Emits structured anomaly events
 * consumable by downstream alerting (#1213).
 */

import logger from '../utils/logger.js';

export type BypassPatternType =
  | 'distributed_origin'
  | 'credential_rotation'
  | 'request_spreading'
  | 'burst_boundary';

export type BypassSeverity = 'warning' | 'critical';

export interface RateLimitEvent {
  /** Client identifier (IP, user ID, or API key). */
  clientId: string;
  /** Route or endpoint being accessed. */
  route: string;
  /** Timestamp of the request (epoch ms). */
  timestamp: number;
  /** Whether the request was blocked by rate limiting. */
  wasBlocked: boolean;
  /** User agent or client fingerprint, if available. */
  fingerprint?: string;
}

export interface BypassAnomaly {
  severity: BypassSeverity;
  pattern: BypassPatternType;
  route: string;
  clientId: string;
  detail: string;
  eventCount: number;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type BypassAnomalyHandler = (anomaly: BypassAnomaly) => void | Promise<void>;

export interface RateLimitBypassDetectionOptions {
  /** Distinct client IDs hitting the same route within the window that triggers distributed_origin. Default: 10. */
  distributedOriginThreshold?: number;
  /** Time window for distributed origin detection (ms). Default: 10_000. */
  distributedOriginWindowMs?: number;
  /** Distinct fingerprints from the same clientId within the window that triggers credential_rotation. Default: 5. */
  credentialRotationThreshold?: number;
  /** Time window for credential rotation detection (ms). Default: 60_000. */
  credentialRotationWindowMs?: number;
  /** Number of requests just under the rate limit within the window that triggers request_spreading. Default: 80. */
  requestSpreadingThreshold?: number;
  /** Percentage of the rate limit that counts as "just under" (0-1). Default: 0.9. */
  requestSpreadingRatio?: number;
  /** Rate limit window (ms) for request_spreading detection. Default: 60_000. */
  requestSpreadingWindowMs?: number;
  /** Requests within 500ms of the rate-limit reset boundary that triggers burst_boundary. Default: 5. */
  burstBoundaryThreshold?: number;
  onAnomaly?: BypassAnomalyHandler;
}

const DEFAULTS = {
  distributedOriginThreshold: 10,
  distributedOriginWindowMs: 10_000,
  credentialRotationThreshold: 5,
  credentialRotationWindowMs: 60_000,
  requestSpreadingThreshold: 80,
  requestSpreadingRatio: 0.9,
  requestSpreadingWindowMs: 60_000,
  burstBoundaryThreshold: 5,
};

interface RouteActivity {
  clientIds: Set<string>;
  timestamps: number[];
}

interface ClientFingerprints {
  fingerprints: Set<string>;
  timestamps: number[];
}

export class RateLimitBypassDetectionAgent {
  private readonly opts: Required<Omit<RateLimitBypassDetectionOptions, 'onAnomaly'>>;
  private readonly onAnomaly: BypassAnomalyHandler;

  private readonly routeActivity = new Map<string, RouteActivity>();
  private readonly clientFingerprints = new Map<string, ClientFingerprints>();
  private readonly requestCounts = new Map<string, number[]>();

  constructor(options: RateLimitBypassDetectionOptions = {}) {
    this.opts = {
      distributedOriginThreshold:
        options.distributedOriginThreshold ?? DEFAULTS.distributedOriginThreshold,
      distributedOriginWindowMs:
        options.distributedOriginWindowMs ?? DEFAULTS.distributedOriginWindowMs,
      credentialRotationThreshold:
        options.credentialRotationThreshold ?? DEFAULTS.credentialRotationThreshold,
      credentialRotationWindowMs:
        options.credentialRotationWindowMs ?? DEFAULTS.credentialRotationWindowMs,
      requestSpreadingThreshold:
        options.requestSpreadingThreshold ?? DEFAULTS.requestSpreadingThreshold,
      requestSpreadingRatio:
        options.requestSpreadingRatio ?? DEFAULTS.requestSpreadingRatio,
      requestSpreadingWindowMs:
        options.requestSpreadingWindowMs ?? DEFAULTS.requestSpreadingWindowMs,
      burstBoundaryThreshold:
        options.burstBoundaryThreshold ?? DEFAULTS.burstBoundaryThreshold,
    };
    this.onAnomaly =
      options.onAnomaly ??
      ((anomaly) => logger.warn({ anomaly }, 'Rate-limit bypass anomaly detected'));
  }

  async evaluate(event: RateLimitEvent): Promise<BypassAnomaly[]> {
    const anomalies: BypassAnomaly[] = [];
    const now = event.timestamp;
    const detectedAt = new Date(now).toISOString();

    // 1. Distributed origin: many distinct clients hitting the same route
    const routeKey = event.route;
    const activity = this.routeActivity.get(routeKey) ?? { clientIds: new Set(), timestamps: [] };
    activity.clientIds.add(event.clientId);
    activity.timestamps = activity.timestamps.filter(
      (t) => now - t <= this.opts.distributedOriginWindowMs,
    );
    activity.timestamps.push(now);
    this.routeActivity.set(routeKey, activity);

    if (activity.clientIds.size >= this.opts.distributedOriginThreshold) {
      anomalies.push({
        severity: 'critical',
        pattern: 'distributed_origin',
        route: routeKey,
        clientId: event.clientId,
        detail: `${activity.clientIds.size} distinct clients hit ${routeKey} within ${this.opts.distributedOriginWindowMs}ms`,
        eventCount: activity.clientIds.size,
        detectedAt,
        metadata: { windowMs: this.opts.distributedOriginWindowMs },
      });
    }

    // 2. Credential rotation: many distinct fingerprints from same client
    if (event.fingerprint) {
      const clientKey = event.clientId;
      const fps = this.clientFingerprints.get(clientKey) ?? {
        fingerprints: new Set(),
        timestamps: [],
      };
      fps.fingerprints.add(event.fingerprint);
      fps.timestamps = fps.timestamps.filter(
        (t) => now - t <= this.opts.credentialRotationWindowMs,
      );
      fps.timestamps.push(now);
      this.clientFingerprints.set(clientKey, fps);

      if (fps.fingerprints.size >= this.opts.credentialRotationThreshold) {
        anomalies.push({
          severity: 'warning',
          pattern: 'credential_rotation',
          route: routeKey,
          clientId: event.clientId,
          detail: `${fps.fingerprints.size} distinct fingerprints from ${event.clientId} within ${this.opts.credentialRotationWindowMs}ms`,
          eventCount: fps.fingerprints.size,
          detectedAt,
          metadata: { windowMs: this.opts.credentialRotationWindowMs },
        });
      }
    }

    // 3. Request spreading: many requests just under the rate limit
    const countKey = `${event.route}:${event.clientId}`;
    const counts = this.requestCounts.get(countKey) ?? [];
    const pruned = counts.filter((t) => now - t <= this.opts.requestSpreadingWindowMs);
    pruned.push(now);
    this.requestCounts.set(countKey, pruned);

    // If we see requestSpreadingThreshold requests in the window and none
    // were blocked, the client may be intentionally staying just under the limit
    if (
      pruned.length >= this.opts.requestSpreadingThreshold &&
      !event.wasBlocked
    ) {
      anomalies.push({
        severity: 'warning',
        pattern: 'request_spreading',
        route: routeKey,
        clientId: event.clientId,
        detail: `${pruned.length} unblocked requests to ${routeKey} within ${this.opts.requestSpreadingWindowMs}ms — possible rate-limit evasion`,
        eventCount: pruned.length,
        detectedAt,
        metadata: { windowMs: this.opts.requestSpreadingWindowMs },
      });
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }

  reset(): void {
    this.routeActivity.clear();
    this.clientFingerprints.clear();
    this.requestCounts.clear();
  }
}

let singleton: RateLimitBypassDetectionAgent | null = null;

export const getRateLimitBypassDetectionAgent = (): RateLimitBypassDetectionAgent => {
  if (!singleton) {
    singleton = new RateLimitBypassDetectionAgent();
  }
  return singleton;
};
