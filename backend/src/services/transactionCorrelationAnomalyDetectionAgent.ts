/**
 * Cross-service Transaction Correlation Anomaly Detection Agent.
 *
 * Groups transaction audit records by a shared correlation id and surfaces
 * inconsistencies between the records of one correlated flow.
 *
 * Resolves Issue #1197.
 */

import { randomUUID } from 'node:crypto';
import type { AnomalyEvent, AnomalyEventHandler } from '../types/anomalyEvent.js';
import type { AuditRecord } from './transactionAuditService.js';

export const CORRELATION_METADATA_KEY = 'correlationId';

export interface TransactionCorrelationOptions {
  /** Maximum allowed spread in ledger sequence across records sharing a correlation id. Default: 10. */
  maxLedgerSpread?: number;
  /** Optional callback or event handler for downstream alerting. */
  onAnomaly?: AnomalyEventHandler;
}

function readNumberEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return process.env[name] !== undefined && Number.isFinite(parsed) ? parsed : fallback;
}

export class TransactionCorrelationAnomalyDetectionAgent {
  readonly id = 'transaction-correlation-anomaly-detection';
  private readonly maxLedgerSpread: number;
  private readonly onAnomaly?: AnomalyEventHandler;

  constructor(options: TransactionCorrelationOptions = {}) {
    this.maxLedgerSpread =
      options.maxLedgerSpread ?? readNumberEnv('TX_CORRELATION_MAX_LEDGER_SPREAD', 10);
    this.onAnomaly = options.onAnomaly;
  }

  /**
   * Evaluates audit records that share a correlation id for cross-service inconsistencies.
   */
  async evaluateRecords(params: {
    records: AuditRecord[];
    organizationId?: number;
    now?: number;
  }): Promise<AnomalyEvent[]> {
    const { organizationId } = params;
    const now = params.now ?? Date.now();
    const groups = new Map<string, AuditRecord[]>();

    for (const record of params.records) {
      const correlationId = record.metadata?.[CORRELATION_METADATA_KEY];
      if (typeof correlationId !== 'string') {
        continue;
      }
      const group = groups.get(correlationId);
      if (group) {
        group.push(record);
      } else {
        groups.set(correlationId, [record]);
      }
    }

    const anomalies: AnomalyEvent[] = [];
    for (const [correlationId, records] of groups) {
      if (records.length < 2) {
        continue;
      }
      const txHashes = records.map((record) => record.tx_hash);
      const sourceAccounts = new Set(records.map((record) => record.source_account));
      const outcomes = new Set(records.map((record) => record.successful));
      const ledgers = records.map((record) => record.ledger_sequence);
      const ledgerSpread = Math.max(...ledgers) - Math.min(...ledgers);

      if (sourceAccounts.size > 1) {
        anomalies.push({
          id: randomUUID(),
          agentId: this.id,
          organizationId,
          severity: 'critical',
          reason: 'correlation_source_mismatch',
          title: 'Correlated Transactions Have Different Source Accounts',
          description: `Correlation ${correlationId} spans ${sourceAccounts.size} source accounts`,
          detectedAt: new Date(now).toISOString(),
          metadata: {
            correlationId,
            txHashes,
            sourceAccounts: [...sourceAccounts],
          },
        });
      }

      if (outcomes.size > 1) {
        anomalies.push({
          id: randomUUID(),
          agentId: this.id,
          organizationId,
          severity: 'warning',
          reason: 'correlation_outcome_mismatch',
          title: 'Correlated Transactions Disagree on Outcome',
          description: `Correlation ${correlationId} has both successful and failed transactions`,
          detectedAt: new Date(now).toISOString(),
          metadata: {
            correlationId,
            txHashes,
          },
        });
      }

      if (ledgerSpread > this.maxLedgerSpread) {
        anomalies.push({
          id: randomUUID(),
          agentId: this.id,
          organizationId,
          severity: 'warning',
          reason: 'correlation_ledger_spread',
          title: 'Correlated Transactions Settled Far Apart',
          description: `Correlation ${correlationId} spans ${ledgerSpread} ledgers, above the ${this.maxLedgerSpread} ledger limit`,
          detectedAt: new Date(now).toISOString(),
          metadata: {
            correlationId,
            txHashes,
            ledgerSpread,
            threshold: this.maxLedgerSpread,
          },
        });
      }
    }

    if (this.onAnomaly && anomalies.length > 0) {
      for (const anomaly of anomalies) {
        try {
          await this.onAnomaly(anomaly);
        } catch {
          // ignore delivery failures
        }
      }
    }

    return anomalies;
  }
}

export const transactionCorrelationAnomalyDetectionAgent =
  new TransactionCorrelationAnomalyDetectionAgent();
