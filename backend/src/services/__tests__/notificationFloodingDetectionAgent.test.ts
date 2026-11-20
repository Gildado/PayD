import { NotificationFloodingDetectionAgent } from '../notificationFloodingDetectionAgent';

describe('NotificationFloodingDetectionAgent', () => {
  it('fires on user flood (true positive)', async () => {
    const agent = new NotificationFloodingDetectionAgent({
      userFloodCountThreshold: 5,
      userFloodWindowMs: 60_000,
    });

    const now = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const anomalies = await agent.evaluate({
        notificationId: `notif-${i}`,
        userId: 'user-flood',
        templateId: 'tmpl-1',
        channel: 'email',
        timestamp: now + i * 100,
      });
      results.push(anomalies.length);
    }

    // Fifth notification should trigger user flood alert
    expect(results[4]).toBeGreaterThan(0);
    const lastAnomalies = await agent.evaluate({
      notificationId: 'notif-check',
      userId: 'user-flood',
      templateId: 'tmpl-1',
      channel: 'email',
      timestamp: now + 600,
    });
    // Should have at least one user_flood anomaly
    expect(lastAnomalies.some((a) => a.reason === 'user_flood')).toBe(true);
  });

  it('does not fire on normal volume (true negative)', async () => {
    const agent = new NotificationFloodingDetectionAgent({
      userFloodCountThreshold: 20,
    });

    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const anomalies = await agent.evaluate({
        notificationId: `notif-ok-${i}`,
        userId: 'user-normal',
        templateId: 'tmpl-1',
        channel: 'email',
        timestamp: now + i * 1000,
      });
      expect(anomalies).toHaveLength(0);
    }
  });

  it('fires on template flood (true positive)', async () => {
    const agent = new NotificationFloodingDetectionAgent({
      templateFloodCountThreshold: 5,
      templateFloodWindowMs: 300_000,
    });

    const now = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const anomalies = await agent.evaluate({
        notificationId: `notif-tmpl-${i}`,
        userId: `user-${i}`,
        templateId: 'tmpl-flood',
        channel: 'push',
        timestamp: now + i * 100,
      });
      results.push(anomalies.length);
    }

    expect(results[4]).toBeGreaterThan(0);
  });
});
