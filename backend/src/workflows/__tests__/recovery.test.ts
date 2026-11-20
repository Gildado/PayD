jest.mock('../../config/database.js', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { MemoryWorkflowStore } from './fixtures.js';
import {
  WorkflowRecoveryRegistry,
  QUARANTINED_STATUS,
  recoverInFlightWorkflows,
  type ResumeAction,
} from '../recovery.js';
import type { WorkflowRecord } from '../store.js';
import { registerBuiltInRecoveryHandlers, recoverInFlightWorkflowsOnBoot } from '../bootRecovery.js';

const KIND = 'workflow-notification-delivery' as const;

function registryWith(
  resume: (record: WorkflowRecord) => Promise<ResumeAction>
): WorkflowRecoveryRegistry {
  const registry = new WorkflowRecoveryRegistry();
  registry.register({ kind: KIND, resume });
  return registry;
}

describe('boot-time workflow recovery', () => {
  it('resumes in-flight records after a restart and is idempotent on the next scan', async () => {
    const backing = new Map();
    const store = new MemoryWorkflowStore(backing);
    await store.create(1, KIND, 'notify:20', 'sending', { messageId: 'msg-123' });

    const registry = registryWith(async () => ({ action: 'resume', status: 'sent' }));
    const first = await recoverInFlightWorkflows(store, registry);

    expect(first.scanned).toBe(1);
    expect(first.resumed).toHaveLength(1);
    expect(first.quarantined).toHaveLength(0);
    const resumed = await store.get(1, first.resumed[0].id);
    expect(resumed.status).toBe('sent');
    expect(resumed.data.__recoveryAttempts).toBe(0);
    expect(resumed.data.__recoveredAt).toBeDefined();

    // A fresh process owns a fresh store instance over the same durable records.
    const restartedStore = new MemoryWorkflowStore(backing);
    const restartedRegistry = registryWith(async () => ({ action: 'resume', status: 'sent' }));
    const second = await recoverInFlightWorkflows(restartedStore, restartedRegistry);

    expect(second.scanned).toBe(0);
    expect(second.resumed).toHaveLength(0);
  });

  it('quarantines a poison workflow once its handler exhausts the retry budget', async () => {
    const store = new MemoryWorkflowStore();
    const created = await store.create(1, KIND, 'poison:1', 'sending', {
      __recoveryAttempts: 2,
    });

    const registry = registryWith(async () => {
      throw new Error('poison step keeps failing');
    });
    const report = await recoverInFlightWorkflows(store, registry, { maxAttempts: 3 });

    expect(report.resumed).toHaveLength(0);
    expect(report.quarantined).toHaveLength(1);
    const fenced = await store.get(1, created.id);
    expect(fenced.status).toBe(QUARANTINED_STATUS);
    expect(fenced.data.__quarantineReason).toMatch(/resume_attempts_exhausted.*poison step keeps failing/);
    expect(fenced.data.__quarantinedAt).toBeDefined();

    const next = await recoverInFlightWorkflows(store, registry);
    expect(next.scanned).toBe(0);
  });

  it('quarantines records with malformed persisted data', async () => {
    const store = new MemoryWorkflowStore();
    const created = await store.create(1, KIND, 'corrupt:1', 'sending', {});
    store.records.get(created.id)!.data = null as unknown as Record<string, unknown>;

    const report = await recoverInFlightWorkflows(
      store,
      registryWith(async () => ({ action: 'skip', reason: 'unused' }))
    );

    expect(report.quarantined).toHaveLength(1);
    expect(report.quarantined[0].reason).toBe('invalid_record_data');
    expect((await store.get(1, created.id)).status).toBe(QUARANTINED_STATUS);
  });

  it('skips unknown workflow kinds instead of quarantining them', async () => {
    const store = new MemoryWorkflowStore();
    const created = await store.create(1, 'freeze-appeal', 'appeal:1', 'executing', {});

    const report = await recoverInFlightWorkflows(store, new WorkflowRecoveryRegistry());

    expect(report.skipped).toEqual([{ id: created.id, reason: 'no_recovery_handler' }]);
    expect(report.quarantined).toHaveLength(0);
    expect((await store.get(1, created.id)).status).toBe('executing');
  });

  it('increments an attempt counter for retryable failures without changing status', async () => {
    const store = new MemoryWorkflowStore();
    const created = await store.create(1, KIND, 'flaky:1', 'submitted', {});

    const report = await recoverInFlightWorkflows(
      store,
      registryWith(async () => {
        throw new Error('upstream still pending');
      }),
      { maxAttempts: 3 }
    );

    expect(report.retried).toEqual([{ id: created.id, attempts: 1 }]);
    const record = await store.get(1, created.id);
    expect(record.status).toBe('submitted');
    expect(record.data.__recoveryAttempts).toBe(1);
  });

  it('never double-resumes a record already claimed by another caller (atomic CAS)', async () => {
    const store = new MemoryWorkflowStore();
    const created = await store.create(1, KIND, 'race:1', 'sending', { messageId: 'm-1' });
    const registry = registryWith(async (record) => {
      // Simulate another worker finishing the record between our read and write.
      await store.transition(record, 'sent', { messageId: 'm-1' });
      return { action: 'resume', status: 'sent' };
    });

    const report = await recoverInFlightWorkflows(store, registry);

    expect(report.conflicts).toBe(1);
    expect(report.resumed).toHaveLength(0);
    expect((await store.get(1, created.id)).status).toBe('sent');
  });

  it('rejects a handler that tries to park a record back in an in-flight state', async () => {
    const store = new MemoryWorkflowStore();
    const created = await store.create(1, KIND, 'loop:1', 'sending', {});

    const report = await recoverInFlightWorkflows(
      store,
      registryWith(async () => ({ action: 'resume', status: 'sending' }))
    );

    expect(report.quarantined[0].reason).toBe('invalid_resume_status');
    expect((await store.get(1, created.id)).status).toBe(QUARANTINED_STATUS);
  });

  it('built-in notification handler resumes only when delivery is proven', async () => {
    const store = new MemoryWorkflowStore();
    const delivered = await store.create(1, KIND, 'notify:2', 'sending', { messageId: 'msg-2' });
    const unknown = await store.create(1, KIND, 'notify:3', 'sending', {});

    const report = await recoverInFlightWorkflowsOnBoot(store, new WorkflowRecoveryRegistry());

    expect(report).not.toBeNull();
    expect(report!.resumed.map((r) => r.id)).toEqual([delivered.id]);
    expect(report!.skipped.map((s) => s.reason)).toContain('delivery_outcome_unknown');
    expect((await store.get(1, unknown.id)).status).toBe('sending');
  });

  it('never blocks startup when the recovery scan hangs', async () => {
    const hangingStore = {
      listInFlight: () => new Promise<never>(() => {}),
    } as unknown as MemoryWorkflowStore;

    const start = Date.now();
    const report = await recoverInFlightWorkflowsOnBoot(
      hangingStore,
      new WorkflowRecoveryRegistry(),
      25
    );
    const elapsedMs = Date.now() - start;

    expect(report).toBeNull();
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('registers built-in handlers without duplicating them', () => {
    const registry = new WorkflowRecoveryRegistry();
    registerBuiltInRecoveryHandlers(registry);
    registerBuiltInRecoveryHandlers(registry);
    expect(registry.size).toBe(1);
    expect(registry.has(KIND)).toBe(true);
  });
});
