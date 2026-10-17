/**
 * Anomalous login/session detection agent (#1205).
 *
 * Detects logins with unusual geography, device, or velocity patterns
 * from authService.ts. Evaluates each login against configurable thresholds
 * and emits structured anomaly events.
 *
 * Detection signals:
 * - `geo_anomaly`: login from a new country/region not seen before for this user
 * - `velocity_anomaly`: too many logins in a short time window
 * - `device_anomaly`: login from a previously unseen device fingerprint
 */

import logger from '../utils/logger.js';

export type LoginAnomalyType = 'geo_anomaly' | 'velocity_anomaly' | 'device_anomaly';

export interface LoginEvent {
  userId: string;
  organizationId: number;
  ipAddress: string;
  country?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  loginAt: number;
}

export interface LoginAnomalyEvent {
  agentId: 'login_anomaly_detection';
  anomalyType: LoginAnomalyType;
  severity: 'warning' | 'critical';
  userId: string;
  organizationId: number;
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type LoginAnomalyHandler = (event: LoginAnomalyEvent) => void | Promise<void>;

export interface LoginAnomalyDetectionOptions {
  /** Number of logins in the velocity window that triggers an alert. Default: 10. */
  velocityWindowMs?: number;
  /** Count threshold for velocity detection. Default: 10. */
  velocityCountThreshold?: number;
  /** Whether to enable geo anomaly detection. Default: true. */
  enableGeoDetection?: boolean;
  /** Whether to enable device anomaly detection. Default: true. */
  enableDeviceDetection?: boolean;
  onAnomaly?: LoginAnomalyHandler;
}

interface UserLoginState {
  knownCountries: Set<string>;
  knownDevices: Set<string>;
  loginTimestamps: number[];
}

const DEFAULTS = {
  velocityWindowMs: 300_000, // 5 minutes
  velocityCountThreshold: 10,
  enableGeoDetection: true,
  enableDeviceDetection: true,
};

export class LoginAnomalyDetectionAgent {
  private readonly velocityWindowMs: number;
  private readonly velocityCountThreshold: number;
  private readonly enableGeoDetection: boolean;
  private readonly enableDeviceDetection: boolean;
  private readonly onAnomaly: LoginAnomalyHandler;

  /** Per-user login history for anomaly detection. */
  private readonly userState = new Map<string, UserLoginState>();

  constructor(options: LoginAnomalyDetectionOptions = {}) {
    this.velocityWindowMs = options.velocityWindowMs ?? DEFAULTS.velocityWindowMs;
    this.velocityCountThreshold =
      options.velocityCountThreshold ?? DEFAULTS.velocityCountThreshold;
    this.enableGeoDetection = options.enableGeoDetection ?? DEFAULTS.enableGeoDetection;
    this.enableDeviceDetection = options.enableDeviceDetection ?? DEFAULTS.enableDeviceDetection;
    this.onAnomaly =
      options.onAnomaly ??
      ((event) => logger.warn({ event }, 'Login anomaly detected'));
  }

  /**
   * Evaluates one login event, updating per-user state and emitting
   * zero or more anomaly events.
   */
  async evaluate(login: LoginEvent): Promise<LoginAnomalyEvent[]> {
    const anomalies: LoginAnomalyEvent[] = [];
    const now = Date.now();
    const detectedAt = new Date(now).toISOString();

    let state = this.userState.get(login.userId);
    if (!state) {
      state = { knownCountries: new Set(), knownDevices: new Set(), loginTimestamps: [] };
      this.userState.set(login.userId, state);
    }

    // 1. Geo anomaly — login from a country not seen before for this user
    if (this.enableGeoDetection && login.country) {
      const isFirstLogin = state.knownCountries.size === 0;
      const isNewCountry = !state.knownCountries.has(login.country);

      if (!isFirstLogin && isNewCountry) {
        anomalies.push({
          agentId: 'login_anomaly_detection',
          anomalyType: 'geo_anomaly',
          severity: 'warning',
          userId: login.userId,
          organizationId: login.organizationId,
          detail: `Login from new country "${login.country}" (previously seen: ${[...state.knownCountries].join(', ')})`,
          detectedAt,
          metadata: { newCountry: login.country, knownCountries: [...state.knownCountries], ipAddress: login.ipAddress },
        });
      }
      state.knownCountries.add(login.country);
    }

    // 2. Device anomaly — login from a previously unseen device
    if (this.enableDeviceDetection && login.deviceFingerprint) {
      const isFirstLogin = state.knownDevices.size === 0;
      const isNewDevice = !state.knownDevices.has(login.deviceFingerprint);

      if (!isFirstLogin && isNewDevice) {
        anomalies.push({
          agentId: 'login_anomaly_detection',
          anomalyType: 'device_anomaly',
          severity: 'warning',
          userId: login.userId,
          organizationId: login.organizationId,
          detail: `Login from new device "${login.deviceFingerprint.slice(0, 12)}..." (previously seen: ${state.knownDevices.size} devices)`,
          detectedAt,
          metadata: { deviceFingerprint: login.deviceFingerprint, userAgent: login.userAgent },
        });
      }
      state.knownDevices.add(login.deviceFingerprint);
    }

    // 3. Velocity anomaly — too many logins in a short window
    state.loginTimestamps.push(login.loginAt);
    state.loginTimestamps = state.loginTimestamps.filter(
      (ts) => now - ts < this.velocityWindowMs,
    );

    if (state.loginTimestamps.length >= this.velocityCountThreshold) {
      anomalies.push({
        agentId: 'login_anomaly_detection',
        anomalyType: 'velocity_anomaly',
        severity: 'critical',
        userId: login.userId,
        organizationId: login.organizationId,
        detail: `${state.loginTimestamps.length} logins in ${this.velocityWindowMs}ms exceeds threshold of ${this.velocityCountThreshold}`,
        detectedAt,
        metadata: { count: state.loginTimestamps.length, windowMs: this.velocityWindowMs },
      });
    }

    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }
}
