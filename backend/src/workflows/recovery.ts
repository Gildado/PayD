/**
 * Boot-time recovery for durable orchestration records.
 *
 * Postgres already gives the records ACID durability and atomic compare-and-set
 * transitions (see store.ts). What was missing is an active scan after a process
 * restart: a workflow can be killed between steps and left in a non-terminal
 * status forever. This module scans those records, delegates reconciliation to
 * a registered, domain-aware handler, and quarantines records that cannot be
 * safely resumed (malformed state or a handler that keeps failing).
 *
 * Handlers must be explicitly registered. An unknown kind is *skipped*, never
 * quarantined, so adding recovery cannot by itself corrupt a workflow we do not
 * know how to reconcile.
 */
import { WorkflowError } from './runtime.js';
import type { WorkflowKind, WorkflowRecord, WorkflowStore } from './store.js';

/** Status written when a record is fenced off for operator inspection. */
export const QUARANTINED_STATUS = 'quarantined';

/** How many failed resume attempts are tolerated before quarantining. */
export const MAX_RESUME_ATTEMPTS = 3;

/** Non-terminal statuses that a crashed workflow can be left in. */
export const IN_FLIGHT_STATUSES: readonly string[] = [
  'pending',
  'pending_review',
  'preparing',
  'awaiting_signature',
  'submitted',
  'executing',
  'processing',
  'simulating',
  'sending',
  'notifying',
  'tracking',
  'rolling_back',
];

const ATTEMPTS_FIELD = '__recoveryAttempts';
const QUARANTINE_REASON_FIELD = '__quarantineReason';
const QUARANTINED_AT_FIELD = '__quarantinedAt';
const RECOVERED_AT_FIELD = '__recoveredAt';

/** What a domain-aware handler wants the engine to do with a record. */
export type ResumeAction =
  | { action: 'resume'; status: string; data?: Record<string, unknown> }
  | { action: 'skip'; reason: string }
  | { action: 'retry'; reason: string };

export interface WorkflowRecoveryHandler {
  kind: WorkflowKind;
  /** Reconcile a single in-flight record. Must be idempotent. */
  resume(record: WorkflowRecord): Promise<ResumeAction>;
}

/** Explicit registry of the workflow kinds we know how to reconcile safely. */
export class WorkflowRecoveryRegistry {
  private readonly handlers = new Map<WorkflowKind, WorkflowRecoveryHandler>();

  register(handler: WorkflowRecoveryHandler): void {
    this.handlers.set(handler.kind, handler);
  }

  get(kind: WorkflowKind): WorkflowRecoveryHandler | undefined {
    return this.handlers.get(kind);
  }

  has(kind: WorkflowKind): boolean {
    return this.handlers.has(kind);
  }

  get size(): number {
    return this.handlers.size;
  }

  /** Test-only helper to avoid cross-test handler leakage. */
  clearForTests(): void {
    this.handlers.clear();
  }
}

export const workflowRecoveryRegistry = new WorkflowRecoveryRegistry();

export interface RecoveryOptions {
  maxAttempts?: number;
  limit?: number;
  statuses?: readonly string[];
}

export interface RecoveryReport {
  scanned: number;
  resumed: WorkflowRecord[];
  skipped: Array<{ id: string; reason: string }>;
  retried: Array<{ id: string; attempts: number }>;
  quarantined: Array<{ record: WorkflowRecord; reason: string }>;
  conflicts: number;
  failures: number;
}

function emptyReport(): RecoveryReport {
  return {
    scanned: 0,
    resumed: [],
    skipped: [],
    retried: [],
    quarantined: [],
    conflicts: 0,
    failures: 0,
  };
}

function safeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 200) || 'unknown resume error';
}

function isPlainData(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

function currentAttempts(record: WorkflowRecord): number {
  const value = isPlainData(record.data) ? record.data[ATTEMPTS_FIELD] : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isConflict(error: unknown): boolean {
  return error instanceof WorkflowError && error.code === 'CONFLICT';
}

async function quarantine(
  store: WorkflowStore,
  record: WorkflowRecord,
  reason: string,
  report: RecoveryReport,
  timestamp: string
): Promise<void> {
  try {
    const updated = await store.transition(record, QUARANTINED_STATUS, {
      ...(isPlainData(record.data) ? record.data : {}),
      [QUARANTINE_REASON_FIELD]: reason.slice(0, 200),
      [QUARANTINED_AT_FIELD]: timestamp,
    });
    report.quarantined.push({ record: updated, reason });
  } catch (error) {
    // A concurrent caller already moved the record; leave it alone.
    if (isConflict(error)) report.conflicts++;
    else report.failures++;
  }
}

/**
 * Scan and reconcile in-flight records. Safe to call repeatedly: every state
 * change is a compare-and-set transition, so two recovering processes cannot
 * both resume the same record.
 */
export async function recoverInFlightWorkflows(
  store: WorkflowStore,
  registry: WorkflowRecoveryRegistry = workflowRecoveryRegistry,
  options: RecoveryOptions = {}
): Promise<RecoveryReport> {
  const report = emptyReport();
  const maxAttempts = options.maxAttempts ?? MAX_RESUME_ATTEMPTS;
  const statuses = options.statuses ?? IN_FLIGHT_STATUSES;
  const timestamp = new Date().toISOString();

  let records: WorkflowRecord[];
  try {
    records = await store.listInFlight(statuses, options.limit ?? 100);
  } catch (error) {
    report.failures++;
    report.skipped.push({ id: 'scan', reason: safeReason(error) });
    return report;
  }
  report.scanned = records.length;

  for (const record of records) {
    if (!isPlainData(record.data)) {
      await quarantine(store, record, 'invalid_record_data', report, timestamp);
      continue;
    }

    const handler = registry.get(record.kind);
    if (!handler) {
      // No safe reconciliation known — leave it for the domain's own resume path.
      report.skipped.push({ id: record.id, reason: 'no_recovery_handler' });
      continue;
    }

    let action: ResumeAction;
    try {
      action = await handler.resume(record);
    } catch (error) {
      action = { action: 'retry', reason: safeReason(error) };
    }

    try {
      if (action.action === 'skip') {
        report.skipped.push({ id: record.id, reason: action.reason });
        continue;
      }

      if (action.action === 'retry') {
        const attempts = currentAttempts(record) + 1;
        if (attempts >= maxAttempts) {
          await quarantine(
            store,
            record,
            `resume_attempts_exhausted: ${action.reason}`,
            report,
            timestamp
          );
        } else {
          const updated = await store.transition(record, record.status, {
            ...record.data,
            [ATTEMPTS_FIELD]: attempts,
          });
          report.retried.push({ id: updated.id, attempts });
        }
        continue;
      }

      // 'resume' — never allow a handler to park a record back in an in-flight
      // or quarantined state; that would silently create a retry loop.
      if (
        !action.status ||
        IN_FLIGHT_STATUSES.includes(action.status) ||
        action.status === QUARANTINED_STATUS
      ) {
        await quarantine(store, record, 'invalid_resume_status', report, timestamp);
        continue;
      }

      const resumed = await store.transition(record, action.status, {
        ...record.data,
        ...(action.data ?? {}),
        [ATTEMPTS_FIELD]: 0,
        [RECOVERED_AT_FIELD]: timestamp,
      });
      report.resumed.push(resumed);
    } catch (error) {
      if (isConflict(error)) {
        report.conflicts++;
      } else {
        report.failures++;
        await quarantine(store, record, `resume_failed: ${safeReason(error)}`, report, timestamp);
      }
    }
  }

  return report;
}
