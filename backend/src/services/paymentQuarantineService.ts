/**
 * Quarantine/hold workflow for flagged payments pending review (#1219).
 *
 * When an anomaly detection agent flags a payment, this service places
 * it on hold rather than letting it proceed. The payment stays in
 * quarantine until an operator reviews and either releases or rejects it.
 *
 * This is the bridge between raw detection signals and actionable
 * enforcement — detections that would otherwise just log an alert now
 * actually prevent suspicious payments from completing.
 */

import logger from '../utils/logger.js';

export type QuarantineStatus = 'held' | 'released' | 'rejected';

export interface QuarantineEntry {
  paymentId: string;
  orgId: string;
  status: QuarantineStatus;
  reason: string;
  triggeredBy: string; // rule name or 'manual'
  amount: number;
  heldAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface QuarantineHandler {
  onHold?(entry: QuarantineEntry): void | Promise<void>;
  onRelease?(entry: QuarantineEntry): void | Promise<void>;
  onReject?(entry: QuarantineEntry): void | Promise<void>;
}

/**
 * In-memory quarantine store. In production this would persist to the
 * database and integrate with the payment processing pipeline.
 */
export class PaymentQuarantineService {
  private entries = new Map<string, QuarantineEntry>();
  private handlers: QuarantineHandler = {};

  constructor(handlers: QuarantineHandler = {}) {
    this.handlers = handlers;
  }

  /**
   * Place a payment on hold. Returns the quarantine entry.
   * If the payment is already held, returns the existing entry (idempotent).
   */
  async hold(
    paymentId: string,
    orgId: string,
    reason: string,
    triggeredBy: string,
    amount: number,
  ): Promise<QuarantineEntry> {
    const existing = this.entries.get(paymentId);
    if (existing && existing.status === 'held') {
      return existing;
    }

    const entry: QuarantineEntry = {
      paymentId,
      orgId,
      status: 'held',
      reason,
      triggeredBy,
      amount,
      heldAt: new Date().toISOString(),
    };
    this.entries.set(paymentId, entry);
    logger.warn({ paymentId, reason, triggeredBy }, 'Payment quarantined');
    await this.handlers.onHold?.(entry);
    return entry;
  }

  /**
   * Release a held payment. Operator action after review.
   */
  async release(
    paymentId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<QuarantineEntry> {
    const entry = this.entries.get(paymentId);
    if (!entry) throw new Error(`Payment ${paymentId} not in quarantine`);
    if (entry.status !== 'held') throw new Error(`Payment ${paymentId} already ${entry.status}`);

    entry.status = 'released';
    entry.resolvedAt = new Date().toISOString();
    entry.resolvedBy = resolvedBy;
    entry.resolutionNote = note;
    logger.info({ paymentId, resolvedBy }, 'Payment released from quarantine');
    await this.handlers.onRelease?.(entry);
    return entry;
  }

  /**
   * Reject a held payment. Operator action after review.
   */
  async reject(
    paymentId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<QuarantineEntry> {
    const entry = this.entries.get(paymentId);
    if (!entry) throw new Error(`Payment ${paymentId} not in quarantine`);
    if (entry.status !== 'held') throw new Error(`Payment ${paymentId} already ${entry.status}`);

    entry.status = 'rejected';
    entry.resolvedAt = new Date().toISOString();
    entry.resolvedBy = resolvedBy;
    entry.resolutionNote = note;
    logger.info({ paymentId, resolvedBy }, 'Payment rejected from quarantine');
    await this.handlers.onReject?.(entry);
    return entry;
  }

  /** Get a single quarantine entry. */
  get(paymentId: string): QuarantineEntry | undefined {
    return this.entries.get(paymentId);
  }

  /** List all held payments for an org. */
  listHeld(orgId: string): QuarantineEntry[] {
    return [...this.entries.values()].filter(
      (e) => e.orgId === orgId && e.status === 'held',
    );
  }

  /** List all entries (held, released, rejected) for an org. */
  listAll(orgId: string): QuarantineEntry[] {
    return [...this.entries.values()].filter((e) => e.orgId === orgId);
  }

  /** Check if a payment is currently held. */
  isHeld(paymentId: string): boolean {
    return this.entries.get(paymentId)?.status === 'held';
  }
}
