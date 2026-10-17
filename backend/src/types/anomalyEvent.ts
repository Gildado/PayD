/**
 * Shared Anomaly Event Types for Mastra AI Anomaly Detection Agents.
 *
 * Defines the standard structured anomaly event emitted by detection agents
 * across CSV import, fee estimation, trustlines, and claimable balances.
 */

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface AnomalyEvent {
  id: string;
  agentId: string;
  organizationId?: number;
  severity: AnomalySeverity;
  reason: string;
  title: string;
  description: string;
  detectedAt: string;
  metadata: Record<string, any>;
}

export type AnomalyEventHandler = (event: AnomalyEvent) => void | Promise<void>;
