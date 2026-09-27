import { Server, Api, rpc } from '@stellar/stellar-sdk';
import { Pool } from 'pg';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import {
  getAnomalousFundMovementAlertService,
  type FundMovementEvent,
} from './anomalousFundMovementAlertService.js';

const FUND_MOVEMENT_EVENT_TYPES = new Set(['refund', 'withdraw', 'transfer', 'payout', 'claim']);

/**
 * Best-effort extraction of a fund-movement shape from a contract event's
 * payload for #1621's anomaly monitoring. Payload shapes vary by contract
 * and event type (see contracts/*/src/lib.rs `events().publish` calls), so
 * this only recognizes the common `[address, amount]` tuple shape and
 * returns null for anything else — callers must not treat null as an
 * error, just as "not a fund-movement event we can currently interpret".
 */
function tryExtractFundMovement(event: ContractEvent): FundMovementEvent | null {
  if (!FUND_MOVEMENT_EVENT_TYPES.has(event.event_type)) return null;

  const payload = event.payload;
  if (!Array.isArray(payload) || payload.length < 2) return null;

  const [fromAddress, amount] = payload;
  if (typeof fromAddress !== 'string') return null;
  const numericAmount = typeof amount === 'string' ? Number(amount) : amount;
  if (typeof numericAmount !== 'number' || !Number.isFinite(numericAmount)) return null;

  return {
    contractId: event.contract_id,
    eventType: event.event_type,
    fromAddress,
    amount: numericAmount,
    ledgerSequence: event.ledger_sequence,
    txHash: event.tx_hash,
  };
}

interface ContractEvent {
  event_id: string;
  contract_id: string;
  event_type: string;
  payload: any;
  ledger_sequence: number;
  tx_hash?: string;
}

interface IndexState {
  last_ledger_sequence: number;
}

export class SorobanEventIndexer {
  private stellarServer: Server;
  private sorobanServer: rpc.Server | null;
  private dbPool: Pool;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_DELAY_MS: number;
  private readonly BATCH_SIZE: number;
  private readonly TARGET_CONTRACTS: string[];

  constructor() {
    this.stellarServer = new Server(config.stellar.horizonUrl);
    this.sorobanServer = config.stellar.sorobanRpcUrl
      ? new rpc.Server(config.stellar.sorobanRpcUrl)
      : null;
    this.dbPool = new Pool({
      connectionString: config.database.url,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Configuration from environment
    this.POLL_DELAY_MS = config.sorobanIndexer.pollDelayMs;
    this.BATCH_SIZE = config.sorobanIndexer.batchSize;
    this.TARGET_CONTRACTS = config.sorobanIndexer.targetContracts;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Soroban event indexer is already running');
      return;
    }

    try {
      await this.initializeIndexState();
      this.isRunning = true;
      logger.info('Starting Soroban event indexer...');
      
      // Start polling for events
      this.startPolling();
    } catch (error) {
      logger.error('Failed to start Soroban event indexer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }

    await this.dbPool.end();
    logger.info('Soroban event indexer stopped');
  }

  private async initializeIndexState(): Promise<void> {
    const client = await this.dbPool.connect();
    try {
      // Ensure the index state record exists
      await client.query(`
        INSERT INTO contract_event_index_state (state_key, last_ledger_sequence)
        VALUES ('soroban_events', 0)
        ON CONFLICT (state_key) DO NOTHING
      `);
    } finally {
      client.release();
    }
  }

  private async getLastIndexedLedger(): Promise<number> {
    const client = await this.dbPool.connect();
    try {
      const result = await client.query<IndexState>(
        'SELECT last_ledger_sequence FROM contract_event_index_state WHERE state_key = $1',
        ['soroban_events']
      );
      
      return result.rows[0]?.last_ledger_sequence || 0;
    } finally {
      client.release();
    }
  }

  private async updateLastIndexedLedger(ledgerSequence: number): Promise<void> {
    const client = await this.dbPool.connect();
    try {
      await client.query(
        'UPDATE contract_event_index_state SET last_ledger_sequence = $1, updated_at = NOW() WHERE state_key = $2',
        [ledgerSequence, 'soroban_events']
      );
    } finally {
      client.release();
    }
  }

  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) return;

      try {
        await this.indexEvents();
      } catch (error) {
        logger.error('Error during event indexing:', error);
      }

      // Schedule next poll
      if (this.isRunning) {
        this.pollInterval = setTimeout(poll, this.POLL_DELAY_MS);
      }
    };

    // Start first poll immediately
    poll();
  }

  private async indexEvents(): Promise<void> {
    if (!this.sorobanServer) {
      logger.warn('Soroban RPC not configured, skipping event indexing');
      return;
    }

    const lastLedger = await this.getLastIndexedLedger();

    try {
      // Get the latest ledger from Soroban RPC
      const latestLedger = await this.sorobanServer.getLatestLedger();

      if (latestLedger.sequence <= lastLedger) {
        logger.debug(`No new ledgers (current: ${latestLedger.sequence}, last indexed: ${lastLedger})`);
        return;
      }

      logger.debug(`Indexing events from ledger ${lastLedger + 1} to ${latestLedger.sequence}`);

      // Query events from the Soroban RPC using the proper API
      const filters = this.TARGET_CONTRACTS.length > 0
        ? this.TARGET_CONTRACTS.map((contractId) => ({ contractIds: [contractId] }))
        : [{ startLedger: lastLedger + 1 }];

      // Get events since the last indexed ledger
      const eventsResponse = await this.sorobanServer.getEvents({
        startLedger: lastLedger + 1,
        limit: this.BATCH_SIZE,
        ...(this.TARGET_CONTRACTS.length > 0 && { contractIds: this.TARGET_CONTRACTS }),
      });

      if (!eventsResponse.events || eventsResponse.events.length === 0) {
        logger.debug(`No new events found after ledger ${lastLedger}`);
        return;
      }

      // Process and store the events
      const events = this.extractEventsFromResponse(eventsResponse);
      if (events.length > 0) {
        await this.storeEvents(events);
      }

      // Update the last indexed ledger to the latest one we've seen
      const maxLedger = Math.max(...events.map((e) => e.ledger_sequence));
      await this.updateLastIndexedLedger(maxLedger);

    } catch (error) {
      logger.error('Failed to index events:', error);
      throw error;
    }
  }

  private extractEventsFromResponse(response: rpc.GetEventsResponse): ContractEvent[] {
    const events: ContractEvent[] = [];

    if (!response.events || response.events.length === 0) {
      return events;
    }

    for (const event of response.events) {
      try {
        const contractEvent: ContractEvent = {
          event_id: event.id,
          contract_id: event.contractId,
          event_type: this.extractEventType(event),
          payload: event,
          ledger_sequence: parseInt(event.ledger),
          tx_hash: event.txHash || undefined,
        };
        events.push(contractEvent);
      } catch (error) {
        logger.warn('Failed to extract event:', error);
        continue;
      }
    }

    return events;
  }

  private extractEventType(event: any): string {
    try {
      // Soroban events have a topic array; join them for the type
      if (Array.isArray(event.topic) && event.topic.length > 0) {
        return event.topic.map((t: any) => this.extractTopicString(t)).join(':');
      }
      if (event.type) {
        return String(event.type);
      }
    } catch (error) {
      logger.warn('Failed to extract event type:', error);
    }
    return 'contract_event';
  }

  private extractTopicString(topic: any): string {
    if (typeof topic === 'string') {
      return topic;
    }
    if (topic && typeof topic === 'object' && topic.contractId) {
      return `contract:${topic.contractId}`;
    }
    return String(topic);
  }

  private async storeEvents(events: ContractEvent[]): Promise<void> {
    if (events.length === 0) return;

    const client = await this.dbPool.connect();
    try {
      await client.query('BEGIN');

      for (const event of events) {
        // Use ON CONFLICT to handle duplicates idempotently
        await client.query(`
          INSERT INTO contract_events (event_id, contract_id, event_type, payload, ledger_sequence, tx_hash)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (event_id, contract_id) DO NOTHING
        `, [
          event.event_id,
          event.contract_id,
          event.event_type,
          JSON.stringify(event.payload),
          event.ledger_sequence,
          event.tx_hash
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to store events:', error);
      throw error;
    } finally {
      client.release();
    }

    // Post-mainnet anomaly monitoring (#1621) — evaluated after the events
    // are durably committed, and wrapped so a bug or unexpected payload
    // shape here can never fail indexing itself (which already succeeded
    // by this point).
    const alertService = getAnomalousFundMovementAlertService();
    for (const event of events) {
      const movement = tryExtractFundMovement(event);
      if (!movement) continue;
      try {
        await alertService.evaluate(movement);
      } catch (error) {
        logger.error('Anomalous fund movement evaluation failed:', error);
      }
    }
  }

  isIndexerRunning(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let sorobanIndexer: SorobanEventIndexer | null = null;

export const getSorobanIndexer = (): SorobanEventIndexer => {
  if (!sorobanIndexer) {
    sorobanIndexer = new SorobanEventIndexer();
  }
  return sorobanIndexer;
};
