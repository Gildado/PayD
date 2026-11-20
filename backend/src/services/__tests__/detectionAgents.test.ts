/**
 * Detection agents tests (#1204, #1205, #1206, #1207).
 *
 * Covers true-positive and true-negative fixture cases for each agent.
 */

import { WebhookSpoofReplayDetectionAgent } from '../webhookSpoofReplayDetectionAgent';
import { LoginAnomalyDetectionAgent } from '../loginAnomalyDetectionAgent';
import { PrivilegedActionAnomalyDetectionAgent } from '../privilegedActionAnomalyDetectionAgent';
import { OrgConfigDriftDetectionAgent } from '../orgConfigDriftDetectionAgent';

describe('WebhookSpoofReplayDetectionAgent (#1204)', () => {
  it('fires on spoofed signature (true positive)', async () => {
    const agent = new WebhookSpoofReplayDetectionAgent();
    const anomalies = await agent.evaluate({
      webhookId: 'wh-1',
      organizationId: 1,
      eventType: 'payroll.completed',
      payload: '{"test":1}',
      signature: 'invalid-signature',
      secretHash: 'abc123',
      sourceIp: '1.2.3.4',
      receivedAt: Date.now(),
    });
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].anomalyType).toBe('spoofed_signature');
    expect(anomalies[0].severity).toBe('critical');
  });

  it('does not fire on valid signature (true negative)', async () => {
    const agent = new WebhookSpoofReplayDetectionAgent();
    const payload = '{"test":1}';
    // First call to establish the expected signature format
    const sig = (agent as any).computeExpectedSignature(payload, 'abc123');
    const anomalies = await agent.evaluate({
      webhookId: 'wh-2',
      organizationId: 1,
      eventType: 'payroll.completed',
      payload,
      signature: sig,
      secretHash: 'abc123',
      sourceIp: '1.2.3.4',
      receivedAt: Date.now(),
    });
    // Should not have spoofed_signature anomaly (may have others depending on state)
    const spoofed = anomalies.filter((a) => a.anomalyType === 'spoofed_signature');
    expect(spoofed.length).toBe(0);
  });

  it('fires on replayed payload (true positive)', async () => {
    const agent = new WebhookSpoofReplayDetectionAgent();
    const payload = '{"replay":true}';
    const sig = (agent as any).computeExpectedSignature(payload, 'secret');

    // First delivery — establishes the payload in history
    await agent.evaluate({
      webhookId: 'wh-3',
      organizationId: 1,
      eventType: 'payment.completed',
      payload,
      signature: sig,
      secretHash: 'secret',
      sourceIp: '1.2.3.4',
      receivedAt: Date.now(),
    });

    // Second delivery with identical payload — replay
    const anomalies = await agent.evaluate({
      webhookId: 'wh-3',
      organizationId: 1,
      eventType: 'payment.completed',
      payload,
      signature: sig,
      secretHash: 'secret',
      sourceIp: '1.2.3.4',
      receivedAt: Date.now(),
    });

    const replayed = anomalies.filter((a) => a.anomalyType === 'replayed_payload');
    expect(replayed.length).toBe(1);
    expect(replayed[0].severity).toBe('critical');
  });
});

describe('LoginAnomalyDetectionAgent (#1205)', () => {
  it('fires on geo anomaly (true positive)', async () => {
    const agent = new LoginAnomalyDetectionAgent();
    // First login — establishes known country
    await agent.evaluate({
      userId: 'user-1',
      organizationId: 1,
      ipAddress: '1.1.1.1',
      country: 'US',
      deviceFingerprint: 'device-a',
      loginAt: Date.now(),
    });

    // Second login from a new country
    const anomalies = await agent.evaluate({
      userId: 'user-1',
      organizationId: 1,
      ipAddress: '2.2.2.2',
      country: 'RU',
      deviceFingerprint: 'device-a',
      loginAt: Date.now(),
    });

    const geo = anomalies.filter((a) => a.anomalyType === 'geo_anomaly');
    expect(geo.length).toBe(1);
    expect(geo[0].severity).toBe('warning');
  });

  it('does not fire on same country login (true negative)', async () => {
    const agent = new LoginAnomalyDetectionAgent();
    await agent.evaluate({
      userId: 'user-2',
      organizationId: 1,
      ipAddress: '1.1.1.1',
      country: 'US',
      deviceFingerprint: 'device-a',
      loginAt: Date.now(),
    });

    const anomalies = await agent.evaluate({
      userId: 'user-2',
      organizationId: 1,
      ipAddress: '1.1.1.1',
      country: 'US',
      deviceFingerprint: 'device-a',
      loginAt: Date.now(),
    });

    const geo = anomalies.filter((a) => a.anomalyType === 'geo_anomaly');
    expect(geo.length).toBe(0);
  });

  it('fires on velocity anomaly (true positive)', async () => {
    const agent = new LoginAnomalyDetectionAgent({
      velocityCountThreshold: 3,
      velocityWindowMs: 60_000,
    });

    for (let i = 0; i < 3; i++) {
      await agent.evaluate({
        userId: 'user-3',
        organizationId: 1,
        ipAddress: '1.1.1.1',
        country: 'US',
        deviceFingerprint: 'device-a',
        loginAt: Date.now(),
      });
    }

    const lastAnomalies = await agent.evaluate({
      userId: 'user-3',
      organizationId: 1,
      ipAddress: '1.1.1.1',
      country: 'US',
      deviceFingerprint: 'device-a',
      loginAt: Date.now(),
    });

    const velocity = lastAnomalies.filter((a) => a.anomalyType === 'velocity_anomaly');
    expect(velocity.length).toBe(1);
    expect(velocity[0].severity).toBe('critical');
  });
});

describe('PrivilegedActionAnomalyDetectionAgent (#1206)', () => {
  it('fires on burst cluster (true positive)', async () => {
    const agent = new PrivilegedActionAnomalyDetectionAgent({
      burstCountThreshold: 3,
      burstWindowMs: 60_000,
    });

    for (let i = 0; i < 3; i++) {
      await agent.evaluate({
        adminUserId: 'admin-1',
        organizationId: 1,
        actionType: 'settings_update',
        targetType: 'org',
        ipAddress: '1.1.1.1',
        performedAt: Date.now(),
      });
    }

    const anomalies = await agent.evaluate({
      adminUserId: 'admin-1',
      organizationId: 1,
      actionType: 'settings_update',
      targetType: 'org',
      ipAddress: '1.1.1.1',
      performedAt: Date.now(),
    });

    const burst = anomalies.filter((a) => a.anomalyType === 'burst_cluster');
    expect(burst.length).toBe(1);
    expect(burst[0].severity).toBe('critical');
  });

  it('does not fire on normal activity (true negative)', async () => {
    const agent = new PrivilegedActionAnomalyDetectionAgent({
      burstCountThreshold: 5,
      burstWindowMs: 60_000,
      enableHourDetection: false,
    });

    const anomalies = await agent.evaluate({
      adminUserId: 'admin-2',
      organizationId: 1,
      actionType: 'read_dashboard',
      targetType: 'dashboard',
      ipAddress: '1.1.1.1',
      performedAt: Date.now(),
    });

    expect(anomalies.length).toBe(0);
  });

  it('fires on high-risk action (true positive)', async () => {
    const agent = new PrivilegedActionAnomalyDetectionAgent({
      enableHourDetection: false,
    });

    const anomalies = await agent.evaluate({
      adminUserId: 'admin-3',
      organizationId: 1,
      actionType: 'contract_upgrade',
      targetType: 'contract',
      ipAddress: '1.1.1.1',
      performedAt: Date.now(),
    });

    const highRisk = anomalies.filter((a) => a.anomalyType === 'high_risk_action');
    expect(highRisk.length).toBe(1);
    expect(highRisk[0].severity).toBe('warning');
  });
});

describe('OrgConfigDriftDetectionAgent (#1207)', () => {
  it('fires on baseline drift (true positive)', async () => {
    const agent = new OrgConfigDriftDetectionAgent();
    agent.setBaseline(1, 'require_mfa', 'true');

    const anomalies = await agent.evaluate({
      organizationId: 1,
      settingKey: 'require_mfa',
      oldValue: 'true',
      newValue: 'false',
      changedBy: 'admin-1',
      changedAt: Date.now(),
    });

    const drift = anomalies.filter((a) => a.anomalyType === 'baseline_drift');
    expect(drift.length).toBe(1);
    expect(drift[0].severity).toBe('warning');
  });

  it('does not fire when setting matches baseline (true negative)', async () => {
    const agent = new OrgConfigDriftDetectionAgent();
    agent.setBaseline(2, 'session_timeout', '30');

    const anomalies = await agent.evaluate({
      organizationId: 2,
      settingKey: 'session_timeout',
      oldValue: '30',
      newValue: '30',
      changedBy: 'admin-2',
      changedAt: Date.now(),
    });

    const drift = anomalies.filter((a) => a.anomalyType === 'baseline_drift');
    expect(drift.length).toBe(0);
  });

  it('fires on high-risk setting change (true positive)', async () => {
    const agent = new OrgConfigDriftDetectionAgent();

    const anomalies = await agent.evaluate({
      organizationId: 3,
      settingKey: 'password_policy',
      oldValue: 'len>=8',
      newValue: 'len>=1',
      changedBy: 'admin-3',
      changedAt: Date.now(),
    });

    const highRisk = anomalies.filter((a) => a.anomalyType === 'high_risk_setting');
    expect(highRisk.length).toBe(1);
  });

  it('fires on rapid changes (true positive)', async () => {
    const agent = new OrgConfigDriftDetectionAgent({
      rapidChangeCountThreshold: 3,
      rapidChangeWindowMs: 60_000,
    });

    for (let i = 0; i < 3; i++) {
      await agent.evaluate({
        organizationId: 4,
        settingKey: `setting_${i}`,
        oldValue: 'a',
        newValue: 'b',
        changedBy: 'admin-4',
        changedAt: Date.now(),
      });
    }

    const anomalies = await agent.evaluate({
      organizationId: 4,
      settingKey: 'setting_final',
      oldValue: 'a',
      newValue: 'b',
      changedBy: 'admin-4',
      changedAt: Date.now(),
    });

    const rapid = anomalies.filter((a) => a.anomalyType === 'rapid_changes');
    expect(rapid.length).toBe(1);
    expect(rapid[0].severity).toBe('critical');
  });
});
