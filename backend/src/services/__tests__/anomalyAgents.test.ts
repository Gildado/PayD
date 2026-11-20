import { RateLimitBypassDetectionAgent, type RateLimitEvent } from '../rateLimitBypassDetectionAgent.js';
import { AnomalyAlertDeliveryAgent, type AnomalyEvent, type AlertChannelConfig } from '../anomalyAlertDeliveryAgent.js';
import { AnomalyTriageWorkflow } from '../anomalyTriageWorkflow.js';
import { AnomalyFeedbackLoop } from '../anomalyFeedbackLoop.js';

// ─── Rate-limit bypass detection (#1212) ─────────────────────────────────────

describe('RateLimitBypassDetectionAgent', () => {
  it('detects distributed origin pattern (true positive)', async () => {
    const agent = new RateLimitBypassDetectionAgent({
      distributedOriginThreshold: 3,
      distributedOriginWindowMs: 10_000,
    });

    const anomalies = [];
    for (let i = 0; i < 3; i++) {
      const result = await agent.evaluate({
        clientId: `client-${i}`,
        route: '/api/payments',
        timestamp: Date.now(),
        wasBlocked: false,
      });
      anomalies.push(...result);
    }

    const distributed = anomalies.find((a) => a.pattern === 'distributed_origin');
    expect(distributed).toBeDefined();
    expect(distributed!.severity).toBe('critical');
  });

  it('does not fire on normal single-client traffic (true negative)', async () => {
    const agent = new RateLimitBypassDetectionAgent();

    const result = await agent.evaluate({
      clientId: 'single-user',
      route: '/api/payments',
      timestamp: Date.now(),
      wasBlocked: false,
    });

    expect(result).toHaveLength(0);
  });

  it('detects credential rotation pattern', async () => {
    const agent = new RateLimitBypassDetectionAgent({
      credentialRotationThreshold: 3,
      credentialRotationWindowMs: 60_000,
    });

    const anomalies = [];
    for (let i = 0; i < 3; i++) {
      const result = await agent.evaluate({
        clientId: 'attacker',
        route: '/api/login',
        timestamp: Date.now(),
        wasBlocked: false,
        fingerprint: `fp-${i}`,
      });
      anomalies.push(...result);
    }

    const rotation = anomalies.find((a) => a.pattern === 'credential_rotation');
    expect(rotation).toBeDefined();
    expect(rotation!.severity).toBe('warning');
  });
});

// ─── Alert delivery (#1213) ──────────────────────────────────────────────────

describe('AnomalyAlertDeliveryAgent', () => {
  const event: AnomalyEvent = {
    id: 'evt-1',
    source: 'test-agent',
    severity: 'critical',
    title: 'Test anomaly',
    description: 'Something happened',
    detectedAt: new Date().toISOString(),
  };

  it('delivers to all channels meeting severity threshold', async () => {
    const delivered: string[] = [];
    const agent = new AnomalyAlertDeliveryAgent({
      channels: [
        { type: 'slack', endpoint: 'https://hooks.slack.test', minSeverity: 'warning' },
        { type: 'webhook', endpoint: 'https://example.com/hook', minSeverity: 'critical' },
      ],
      deliver: async (channel) => { delivered.push(channel.endpoint); },
    });

    const results = await agent.deliver(event);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
    expect(delivered).toHaveLength(2);
  });

  it('skips channels below severity threshold (true negative)', async () => {
    const delivered: string[] = [];
    const agent = new AnomalyAlertDeliveryAgent({
      channels: [
        { type: 'slack', endpoint: 'https://hooks.slack.test', minSeverity: 'critical' },
      ],
      deliver: async (channel) => { delivered.push(channel.endpoint); },
    });

    const infoEvent = { ...event, severity: 'info' as const };
    const results = await agent.deliver(infoEvent);

    expect(results).toHaveLength(0);
    expect(delivered).toHaveLength(0);
  });

  it('retries on failure up to maxRetries', async () => {
    let attempts = 0;
    const agent = new AnomalyAlertDeliveryAgent({
      channels: [
        { type: 'webhook', endpoint: 'https://example.com/hook', maxRetries: 3 },
      ],
      deliver: async () => {
        attempts++;
        if (attempts < 3) throw new Error('transient');
      },
    });

    const results = await agent.deliver(event);

    expect(results[0].success).toBe(true);
    expect(results[0].attempts).toBe(3);
  });
});

// ─── Severity scoring & triage (#1214) ──────────────────────────────────────

describe('AnomalyTriageWorkflow', () => {
  it('scores critical anomalies higher than info', () => {
    const workflow = new AnomalyTriageWorkflow();

    const critical = workflow.score({
      id: '1', source: 'test', severity: 'critical',
      title: 'Critical', description: 'x', detectedAt: new Date().toISOString(),
    });
    const info = workflow.score({
      id: '2', source: 'test', severity: 'info',
      title: 'Info', description: 'x', detectedAt: new Date().toISOString(),
    });

    expect(critical.score).toBeGreaterThan(info.score);
    expect(critical.priority).toBe('critical');
  });

  it('boosts score for repeated anomalies from same source', () => {
    const workflow = new AnomalyTriageWorkflow();

    const event = {
      id: '1', source: 'noisy-source', severity: 'warning' as const,
      title: 'W', description: 'x', detectedAt: new Date().toISOString(),
    };

    const first = workflow.score({ ...event, id: '1' });
    const fifth = workflow.score({ ...event, id: '5' });

    expect(fifth.score).toBeGreaterThan(first.score);
  });

  it('sorts queue by priority', () => {
    const workflow = new AnomalyTriageWorkflow();
    workflow.scoreAndEnqueue({
      id: 'low', source: 'test', severity: 'info',
      title: 'Low', description: 'x', detectedAt: new Date().toISOString(),
    });
    workflow.scoreAndEnqueue({
      id: 'high', source: 'test', severity: 'critical',
      title: 'High', description: 'x', detectedAt: new Date().toISOString(),
    });

    const queue = workflow.getQueue();
    expect(queue[0].anomaly.id).toBe('high');
  });
});

// ─── False-positive feedback loop (#1215) ───────────────────────────────────

describe('AnomalyFeedbackLoop', () => {
  it('reduces sensitivity when FP rate is high', () => {
    const loop = new AnomalyFeedbackLoop({
      minFeedbackForAdjustment: 5,
      fpRateThreshold: 0.5,
    });

    for (let i = 0; i < 5; i++) {
      loop.submitFeedback({
        anomalyId: `a-${i}`,
        source: 'noisy-agent',
        label: i < 4 ? 'false_positive' : 'true_positive',
        feedbackBy: 'operator',
      });
    }

    const multiplier = loop.getThresholdMultiplier('noisy-agent');
    expect(multiplier).toBeGreaterThan(1.0);
  });

  it('increases sensitivity when TP rate is low', () => {
    const loop = new AnomalyFeedbackLoop({
      minFeedbackForAdjustment: 5,
      tpRateThreshold: 0.5,
    });

    for (let i = 0; i < 5; i++) {
      loop.submitFeedback({
        anomalyId: `a-${i}`,
        source: 'dull-agent',
        label: i < 1 ? 'true_positive' : 'benign',
        feedbackBy: 'operator',
      });
    }

    const multiplier = loop.getThresholdMultiplier('dull-agent');
    expect(multiplier).toBeLessThan(1.0);
  });

  it('does not adjust below minimum feedback count (true negative)', () => {
    const loop = new AnomalyFeedbackLoop({
      minFeedbackForAdjustment: 10,
    });

    loop.submitFeedback({
      anomalyId: 'a-1',
      source: 'new-agent',
      label: 'false_positive',
      feedbackBy: 'operator',
    });

    const adjustments = loop.getAdjustments();
    expect(adjustments).toHaveLength(0);
    expect(loop.getThresholdMultiplier('new-agent')).toBe(1.0);
  });
});
