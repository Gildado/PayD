/**
 * Unauthorized contract upgrade attempt detection agent (#1208).
 *
 * Detects upgrade proposals that don't match the expected multisig quorum
 * pattern — e.g. proposals with too few approvals, non-whitelisted signers,
 * or unusual timing patterns. Emits structured anomaly events consumable
 * by downstream alerting.
 *
 * Detection logic is deliberately decoupled from contractUpgradeService's
 * DB/RPC plumbing so it's unit-testable without a database or live endpoint.
 */

import logger from '../utils/logger.js';

export type AnomalySeverity = 'warning' | 'critical';

export interface UpgradeProposalEvent {
  proposalId: string;
  contractId: string;
  proposerAddress: string;
  approvals: string[];
  requiredQuorum: number;
  timestamp: number;
  action: 'propose' | 'approve' | 'execute' | 'cancel';
}

export interface UpgradeAnomalyEvent {
  severity: AnomalySeverity;
  reason: 'insufficient_approvals' | 'unknown_signer' | 'rapid_proposals' | 'quorum_manipulation';
  proposalId: string;
  contractId: string;
  detail: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export type AnomalyEventHandler = (event: UpgradeAnomalyEvent) => void | Promise<void>;

export interface UpgradeDetectionOptions {
  /** Minimum number of approvals required before execute is considered legitimate. Default: 2. */
  minApprovalsForExecute?: number;
  /** Proposals from the same contract within this window count toward rapid-proposal detection. Default: 300_000 (5 min). */
  rapidProposalWindowMs?: number;
  /** Number of proposals within the window that triggers an alert. Default: 3. */
  rapidProposalCountThreshold?: number;
  /** Addresses allowed to approve upgrades (whitelist). Empty = all addresses allowed. */
  allowedSigners?: string[];
  onAnomaly?: AnomalyEventHandler;
}

const DEFAULTS = {
  minApprovalsForExecute: 2,
  rapidProposalWindowMs: 300_000,
  rapidProposalCountThreshold: 3,
};

export class ContractUpgradeDetectionAgent {
  private readonly minApprovalsForExecute: number;
  private readonly rapidProposalWindowMs: number;
  private readonly rapidProposalCountThreshold: number;
  private readonly allowedSigners: Set<string>;
  private readonly onAnomaly: AnomalyEventHandler;

  /** Recent proposal timestamps per contract, for rapid-proposal detection. */
  private readonly proposalActivity = new Map<string, number[]>();

  constructor(options: UpgradeDetectionOptions = {}) {
    this.minApprovalsForExecute = options.minApprovalsForExecute ?? DEFAULTS.minApprovalsForExecute;
    this.rapidProposalWindowMs = options.rapidProposalWindowMs ?? DEFAULTS.rapidProposalWindowMs;
    this.rapidProposalCountThreshold =
      options.rapidProposalCountThreshold ?? DEFAULTS.rapidProposalCountThreshold;
    this.allowedSigners = new Set(options.allowedSigners ?? []);
    this.onAnomaly =
      options.onAnomaly ?? ((event) => logger.warn({ event }, 'Contract upgrade anomaly'));
  }

  /**
   * Evaluates one upgrade proposal event and returns zero or more anomalies.
   */
  async evaluate(event: UpgradeProposalEvent): Promise<UpgradeAnomalyEvent[]> {
    const anomalies: UpgradeAnomalyEvent[] = [];
    const now = Date.now();
    const detectedAt = new Date(now).toISOString();

    // Check for insufficient approvals on execute
    if (event.action === 'execute' && event.approvals.length < this.minApprovalsForExecute) {
      anomalies.push({
        severity: 'critical',
        reason: 'insufficient_approvals',
        proposalId: event.proposalId,
        contractId: event.contractId,
        detail: `Upgrade executed with ${event.approvals.length} approvals (minimum ${this.minApprovalsForExecute})`,
        detectedAt,
        metadata: {
          approvals: event.approvals,
          requiredQuorum: event.requiredQuorum,
          minApprovals: this.minApprovalsForExecute,
        },
      });
    }

    // Check for unknown signers (if whitelist is configured)
    if (this.allowedSigners.size > 0) {
      for (const signer of event.approvals) {
        if (!this.allowedSigners.has(signer)) {
          anomalies.push({
            severity: 'warning',
            reason: 'unknown_signer',
            proposalId: event.proposalId,
            contractId: event.contractId,
            detail: `Approval from non-whitelisted address: ${signer}`,
            detectedAt,
            metadata: { signer, allowedCount: this.allowedSigners.size },
          });
        }
      }
    }

    // Rapid proposal detection
    if (event.action === 'propose') {
      const key = event.contractId;
      const activity = this.proposalActivity.get(key) ?? [];
      activity.push(now);

      // Prune old entries outside the window
      const cutoff = now - this.rapidProposalWindowMs;
      const recent = activity.filter((t) => t > cutoff);
      this.proposalActivity.set(key, recent);

      if (recent.length >= this.rapidProposalCountThreshold) {
        anomalies.push({
          severity: 'warning',
          reason: 'rapid_proposals',
          proposalId: event.proposalId,
          contractId: event.contractId,
          detail: `${recent.length} upgrade proposals within ${this.rapidProposalWindowMs / 1000}s window`,
          detectedAt,
          metadata: {
            proposalCount: recent.length,
            windowMs: this.rapidProposalWindowMs,
            threshold: this.rapidProposalCountThreshold,
          },
        });
      }
    }

    // Emit anomalies to handler
    for (const anomaly of anomalies) {
      await this.onAnomaly(anomaly);
    }

    return anomalies;
  }
}
