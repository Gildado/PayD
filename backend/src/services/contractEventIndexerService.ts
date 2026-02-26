import { query } from '../config/database';

const INDEX_STATE_KEY = 'soroban_contract_events';
const DEFAULT_START_LEDGER = Number(process.env.SOROBAN_EVENT_START_LEDGER || '0');
const POLL_INTERVAL_MS = Number(process.env.SOROBAN_EVENT_POLL_INTERVAL_MS || '12000');
const DEFAULT_RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

interface RpcContractEvent {
  id?: string;
  type?: string;
  txHash?: string;
  ledger?: number;
  ledgerSequence?: number;
  contractId?: string;
  topic?: unknown;
  value?: unknown;
  [key: string]: unknown;
}

interface GetEventsRpcResponse {
  result?: {
    events?: RpcContractEvent[];
    latestLedger?: number;
  };
  error?: { message?: string };
}

export class ContractEventIndexerService {
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;
  private static lock = false;

  static async initialize(): Promise<void> {
    await this.ensureSchema();
    await this.ensureStateRow();
  }

  static start(): void {
    if (this.running) return;
    this.running = true;

    void this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, POLL_INTERVAL_MS);
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  static async pollOnce(): Promise<void> {
    if (this.lock) return;
    this.lock = true;

    try {
      const contracts = this.getIndexedContractIds();
      if (contracts.length === 0) return;

      const state = await query(
        `SELECT last_ledger_sequence
         FROM contract_event_index_state
         WHERE state_key = $1`,
        [INDEX_STATE_KEY]
      );

      const lastIndexed = Number(state.rows[0]?.last_ledger_sequence ?? DEFAULT_START_LEDGER);
      const startLedger = Math.max(lastIndexed + 1, DEFAULT_START_LEDGER);
      const events = await this.fetchContractEvents(startLedger, contracts);

      if (events.length === 0) return;

      let maxLedger = lastIndexed;
      for (const event of events) {
        const contractId = String(event.contractId || '');
        if (!contractId) continue;

        const ledgerSequence = Number(event.ledgerSequence ?? event.ledger ?? 0);
        if (!Number.isFinite(ledgerSequence) || ledgerSequence <= 0) continue;
        maxLedger = Math.max(maxLedger, ledgerSequence);

        const eventId = String(event.id || `${contractId}-${ledgerSequence}-${event.txHash || ''}`);
        const eventType = this.extractEventType(event);
        const txHash = event.txHash ? String(event.txHash) : null;

        await query(
          `INSERT INTO contract_events (event_id, contract_id, event_type, payload, ledger_sequence, tx_hash)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6)
           ON CONFLICT (event_id, contract_id) DO NOTHING`,
          [eventId, contractId, eventType, JSON.stringify(event), ledgerSequence, txHash]
        );
      }

      if (maxLedger > lastIndexed) {
        await query(
          `UPDATE contract_event_index_state
           SET last_ledger_sequence = $1, updated_at = NOW()
           WHERE state_key = $2`,
          [maxLedger, INDEX_STATE_KEY]
        );
      }
    } catch (error) {
      console.error('Contract event indexer error:', error);
    } finally {
      this.lock = false;
    }
  }

  private static async ensureStateRow(): Promise<void> {
    await query(
      `INSERT INTO contract_event_index_state (state_key, last_ledger_sequence)
       VALUES ($1, $2)
       ON CONFLICT (state_key) DO NOTHING`,
      [INDEX_STATE_KEY, DEFAULT_START_LEDGER]
    );
  }

  private static async ensureSchema(): Promise<void> {
    await query(
      `CREATE TABLE IF NOT EXISTS contract_events (
        id BIGSERIAL PRIMARY KEY,
        event_id TEXT NOT NULL,
        contract_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        ledger_sequence BIGINT NOT NULL,
        tx_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_events_event_id
       ON contract_events (event_id, contract_id)`
    );

    await query(
      `CREATE INDEX IF NOT EXISTS idx_contract_events_contract_ledger
       ON contract_events (contract_id, ledger_sequence DESC)`
    );

    await query(
      `CREATE TABLE IF NOT EXISTS contract_event_index_state (
        id BIGSERIAL PRIMARY KEY,
        state_key TEXT NOT NULL UNIQUE,
        last_ledger_sequence BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
  }

  private static getIndexedContractIds(): string[] {
    const envIds = [
      process.env.BULK_PAYMENT_CONTRACT_ID,
      process.env.VESTING_ESCROW_CONTRACT_ID,
      process.env.REVENUE_SPLIT_CONTRACT_ID,
    ]
      .map((value) => (value || '').trim())
      .filter(Boolean);

    return [...new Set(envIds)];
  }

  private static async fetchContractEvents(
    startLedger: number,
    contractIds: string[]
  ): Promise<RpcContractEvent[]> {
    const response = await fetch(DEFAULT_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getEvents',
        params: {
          startLedger,
          filters: [
            {
              type: 'contract',
              contractIds,
            },
          ],
          pagination: { limit: 100 },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`getEvents RPC failed with status ${response.status}`);
    }

    const payload = (await response.json()) as GetEventsRpcResponse;
    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }

    return payload.result?.events ?? [];
  }

  private static extractEventType(event: RpcContractEvent): string {
    if (event.type) return String(event.type);
    if (Array.isArray(event.topic) && event.topic.length > 0) {
      return String(event.topic[0]);
    }
    return 'unknown';
  }
}
