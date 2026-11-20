import { randomUUID } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { WorkflowError, type WorkflowContext } from '../runtime.js';
import type { WorkflowKind, WorkflowRecord, WorkflowStore } from '../store.js';

export const payer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
export const recipient = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));
export const issuer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3));
export const employer: WorkflowContext = { id: 10, organizationId: 1, role: 'EMPLOYER' };
export const employee: WorkflowContext = {
  id: 20,
  organizationId: 1,
  role: 'EMPLOYEE',
  walletAddress: recipient.publicKey(),
};

/** Models Postgres unique references and atomic compare-and-set, including concurrent callers. */
export class MemoryWorkflowStore implements WorkflowStore {
  readonly records = new Map<string, WorkflowRecord>();

  async create(
    organizationId: number,
    kind: WorkflowKind,
    reference: string,
    status: string,
    data: Record<string, unknown>
  ): Promise<WorkflowRecord> {
    const existing = [...this.records.values()].find(
      (record) =>
        record.organization_id === organizationId &&
        record.kind === kind &&
        record.reference === reference
    );
    if (existing) return structuredClone(existing);
    const record = {
      id: randomUUID(),
      organization_id: organizationId,
      kind,
      reference,
      status,
      data,
    };
    this.records.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async get(organizationId: number, id: string): Promise<WorkflowRecord> {
    const record = this.records.get(id);
    if (!record || record.organization_id !== organizationId)
      throw new WorkflowError('NOT_FOUND', 'Not found', 404);
    return structuredClone(record);
  }

  async findByReference(
    organizationId: number,
    kind: WorkflowKind,
    reference: string
  ): Promise<WorkflowRecord | null> {
    const record = [...this.records.values()].find(
      (entry) =>
        entry.organization_id === organizationId &&
        entry.kind === kind &&
        entry.reference === reference
    );
    return record ? structuredClone(record) : null;
  }

  async list(organizationId: number, kind: WorkflowKind): Promise<WorkflowRecord[]> {
    return structuredClone(
      [...this.records.values()].filter(
        (record) => record.organization_id === organizationId && record.kind === kind
      )
    );
  }

  async transition(
    record: WorkflowRecord,
    status: string,
    data = record.data
  ): Promise<WorkflowRecord> {
    const current = await this.get(record.organization_id, record.id);
    // No await between the condition and mutation: mirrors SQL's atomic UPDATE.
    if (this.records.get(record.id)!.status !== record.status)
      throw new WorkflowError('CONFLICT', 'State changed', 409);
    const next = { ...current, status, data: structuredClone(data) };
    this.records.set(record.id, next);
    return structuredClone(next);
  }
}
