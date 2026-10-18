import { SocketAbuseDetectionAgent } from '../socketAbuseDetectionAgent';

describe('SocketAbuseDetectionAgent', () => {
  it('fires on rapid reconnect (true positive)', async () => {
    const agent = new SocketAbuseDetectionAgent({
      rapidReconnectCountThreshold: 5,
      rapidReconnectWindowMs: 60_000,
    });

    const now = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const anomalies = await agent.evaluate({
        clientId: 'client-abuse',
        action: 'connect',
        timestamp: now + i * 100,
        ip: '1.2.3.4',
      });
      results.push(anomalies.length);
    }

    // Fifth connect should trigger rapid-reconnect alert
    expect(results[4]).toBeGreaterThan(0);
  });

  it('does not fire on normal connections (true negative)', async () => {
    const agent = new SocketAbuseDetectionAgent({
      rapidReconnectCountThreshold: 10,
      maxConcurrentPerClient: 5,
    });

    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const anomalies = await agent.evaluate({
        clientId: 'client-normal',
        action: 'connect',
        timestamp: now + i * 30_000, // 30s apart
        ip: '5.6.7.8',
      });
      expect(anomalies).toHaveLength(0);
    }
  });

  it('fires on excessive concurrent connections (true positive)', async () => {
    const agent = new SocketAbuseDetectionAgent({
      maxConcurrentPerClient: 2,
    });

    const now = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 3; i++) {
      const anomalies = await agent.evaluate({
        clientId: 'client-multi',
        action: 'connect',
        timestamp: now + i * 1000,
      });
      results.push(anomalies.length);
    }

    // Third connection exceeds maxConcurrentPerClient=2
    expect(results[2]).toBeGreaterThan(0);
  });

  it('fires on connection storm (true positive)', async () => {
    const agent = new SocketAbuseDetectionAgent({
      connectionStormCountThreshold: 5,
      connectionStormWindowMs: 10_000,
    });

    const now = Date.now();
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const anomalies = await agent.evaluate({
        clientId: `client-storm-${i}`,
        action: 'connect',
        timestamp: now + i * 500,
      });
      results.push(anomalies.length);
    }

    // Fifth connection should trigger connection-storm alert
    expect(results[4]).toBeGreaterThan(0);
  });
});
