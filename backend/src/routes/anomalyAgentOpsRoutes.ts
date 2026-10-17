import { Router } from 'express';
import {
  AgentSlaMonitor,
  AnomalyCorrelator,
  AnomalyDeduplicator,
  makeAnomalyEvent,
} from '../services/anomalyInfrastructure.js';

/**
 * Anomaly agent SLA/latency dashboard + correlation/dedupe introspection (#1225–#1227).
 *
 * In-memory monitors are process-local by design for v1; swap for shared store
 * later without changing response shape.
 */
export function createAnomalyOpsRouter(
  slaMonitor: AgentSlaMonitor = new AgentSlaMonitor(),
  correlator: AnomalyCorrelator = new AnomalyCorrelator(),
  dedupe: AnomalyDeduplicator = new AnomalyDeduplicator(),
): Router {
  const router = Router();

  /** SLA/latency stats per agent (#1226). */
  router.get('/anomaly-agents/sla', (_req, res) => {
    res.json({ data: slaMonitor.allStats() });
  });

  /** Golden-dataset style self-check for regression harnesses (#1224). */
  router.get('/anomaly-agents/golden', (_req, res) => {
    const positive = makeAnomalyEvent({
      id: 'golden-tp',
      agentId: 'golden',
      rule: 'golden_true_positive',
      subject: 'fixture:trigger',
      severity: 'warning',
    });
    const negative = makeAnomalyEvent({
      id: 'golden-tn',
      agentId: 'golden',
      rule: 'golden_true_negative',
      subject: 'fixture:clean',
      severity: 'info',
    });
    const dedupeHit = dedupe.shouldDeliver(positive);
    const corr = correlator.ingest(positive);
    res.json({
      data: {
        truePositiveDelivered: dedupeHit,
        trueNegative: negative.details,
        correlated: corr,
      },
    });
  });

  return router;
}
