/**
 * Anomaly detection runbook generator agent (#1230).
 *
 * Generates a structured incident response runbook from anomaly findings,
 * so operators have step-by-step guidance when responding to alerts.
 */
import type { Pool } from 'pg';
import logger from '../utils/logger.js';

export interface RunbookStep {
  order: number;
  action: string;
  expected: string;
  rollback?: string;
}

export interface AnomalyRunbook {
  schemaVersion: string;
  generatedAt: string;
  anomalyType: string;
  severity: string;
  title: string;
  summary: string;
  investigationSteps: RunbookStep[];
  remediationSteps: RunbookStep[];
  escalationContacts: string[];
  relatedFindings: string[];
}

export interface RunbookRequest {
  organizationId: number;
  findingId: string;
  anomalyType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

export class AnomalyRunbookGeneratorAgent {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Generate a runbook from an anomaly finding.
   */
  async generateRunbook(request: RunbookRequest): Promise<AnomalyRunbook> {
    const investigationSteps = this.buildInvestigationSteps(request);
    const remediationSteps = this.buildRemediationSteps(request);

    const runbook: AnomalyRunbook = {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      anomalyType: request.anomalyType,
      severity: request.severity,
      title: `Runbook: ${request.title}`,
      summary: request.description,
      investigationSteps,
      remediationSteps,
      escalationContacts: await this.getEscalationContacts(request.organizationId),
      relatedFindings: await this.getRelatedFindings(request.organizationId, request.anomalyType),
    };

    logger.info(
      { findingId: request.findingId, anomalyType: request.anomalyType },
      'Anomaly runbook generated'
    );

    return runbook;
  }

  private buildInvestigationSteps(request: RunbookRequest): RunbookStep[] {
    const steps: RunbookStep[] = [
      {
        order: 1,
        action: 'Acknowledge the alert and open an anomaly case',
        expected: 'Case is created and status set to "investigating"',
      },
      {
        order: 2,
        action: 'Review the anomaly metadata and timestamps',
        expected: `Identify affected resources from metadata: ${JSON.stringify(request.metadata ?? {})}`,
      },
      {
        order: 3,
        action: 'Check recent payroll or payment activity in the affected window',
        expected: 'Determine if the anomaly correlates with legitimate business activity',
      },
    ];

    if (request.severity === 'critical') {
      steps.push({
        order: 4,
        action: 'Escalate to security team immediately',
        expected: 'Security team acknowledged within 15 minutes',
      });
    }

    return steps;
  }

  private buildRemediationSteps(request: RunbookRequest): RunbookStep[] {
    const steps: RunbookStep[] = [
      {
        order: 1,
        action: 'Document findings in the anomaly case',
        expected: 'Case has investigation notes and root cause',
      },
      {
        order: 2,
        action: 'Apply remediation or mark as false positive',
        expected: 'Case status set to "resolved" or "false_positive"',
      },
    ];

    if (request.severity === 'critical') {
      steps.push({
        order: 3,
        action: 'Revoke compromised credentials or pause affected payroll runs',
        expected: 'No further unauthorized activity detected',
        rollback: 'Re-enable payroll runs after security clearance',
      });
    }

    return steps;
  }

  private async getEscalationContacts(organizationId: number): Promise<string[]> {
    try {
      const result = await this.pool.query(
        `SELECT email FROM organization_admins WHERE organization_id = $1 AND role = 'admin' LIMIT 5`,
        [organizationId]
      );
      return result.rows.map((r) => r.email);
    } catch {
      return ['security@payd.io'];
    }
  }

  private async getRelatedFindings(organizationId: number, anomalyType: string): Promise<string[]> {
    try {
      const result = await this.pool.query(
        `SELECT id FROM anomaly_findings
         WHERE organization_id = $1 AND agent_id = $2
         ORDER BY detected_at DESC LIMIT 5`,
        [organizationId, anomalyType]
      );
      return result.rows.map((r) => r.id);
    } catch {
      return [];
    }
  }
}
