import type { AnomalyFinding, AnomalySummaryDigestReport } from '../../anomalySummaryDigestAgent.js';

export const FIXTURE_ORG_ID = 100;

export const FIXTURE_ANOMALY_ROWS = [
  {
    id: 'anom-001',
    organization_id: FIXTURE_ORG_ID,
    agent_id: 'fraud_velocity_agent',
    severity: 'critical',
    title: 'High Velocity Payout Spike',
    description: 'Multiple large payouts initiated within 5 minutes.',
    detected_at: '2024-03-01T12:00:00Z',
    metadata: { threshold: 10000, actual: 45000 },
  },
  {
    id: 'anom-002',
    organization_id: FIXTURE_ORG_ID,
    agent_id: 'fraud_geo_agent',
    severity: 'warning',
    title: 'Unusual Geo-IP Access',
    description: 'Admin login from unrecognized jurisdiction.',
    detected_at: '2024-03-01T12:30:00Z',
    metadata: { country: 'XY' },
  },
  {
    id: 'anom-003',
    organization_id: FIXTURE_ORG_ID,
    agent_id: 'fraud_velocity_agent',
    severity: 'info',
    title: 'Minor Batch Deviation',
    description: 'Batch total exceeds rolling average by 15%.',
    detected_at: '2024-03-01T13:00:00Z',
    metadata: { deviationPercent: 15 },
  },
];

export const FIXTURE_EXPECTED = {
  totalAnomalies: 3,
  criticalCount: 1,
  warningCount: 1,
  infoCount: 1,
  topAgent: 'fraud_velocity_agent',
} as const;
