import { Server, Api } from '@stellar/stellar-sdk';
import { Pool } from 'pg';
import logger from '../utils/logger.js';
import config from '../config/index.js';

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
  private dbPool: Pool;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_DELAY_MS: number;
  private readonly BATCH_SIZE: number;
  private readonly TARGET_CONTRACTS: string[];

  constructor() {
    this.stellarServer = new Server(config.stellar.horizonUrl);
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
    const lastLedger = await this.getLastIndexedLedger();
    
    try {
      // Get latest ledger
      const latestLedgerResponse = await this.stellarServer.ledgers().limit(1).order('desc').call();
      const latestSequence = parseInt(latestLedgerResponse.records[0].sequence);
      
      if (latestSequence <= lastLedger) {
        logger.debug(`No new ledgers (current: ${latestSequence}, last indexed: ${lastLedger})`);
        return;
      }

      logger.debug(`Indexing events from ledger ${lastLedger + 1} to ${latestSequence}`);

      // Process ledgers in batches to avoid overwhelming the RPC
      const batchSize = this.BATCH_SIZE;
      const startLedger = lastLedger + 1;
      
      for (let current = startLedger; current <= latestSequence; current += batchSize) {
        const endLedger = Math.min(current + batchSize - 1, latestSequence);
        await this.processLedgerRange(current, endLedger);
      }

    } catch (error) {
      logger.error('Failed to index events:', error);
      throw error;
    }
  }

  private async processLedgerRange(startLedger: number, endLedger: number): Promise<void> {
    try {
      // For Soroban events, we need to look for transactions with contract invocations
      // This is a simplified approach - in production you'd want to use the Soroban RPC directly
      
      // Get transactions for each ledger in the range
      for (let ledgerSeq = startLedger; ledgerSeq <= endLedger; ledgerSeq++) {
        try {
          const transactions = await this.stellarServer
            .transactions()
            .forLedger(ledgerSeq.toString())
            .limit(100)
            .call();

          for (const tx of transactions.records) {
            if (tx.transaction_successful) {
              await this.processTransaction(tx);
            }
          }
        } catch (ledgerError) {
          logger.warn(`Failed to process ledger ${ledgerSeq}:`, ledgerError);
          // Continue with next ledger
        }
      }

      // Update the last indexed ledger
      await this.updateLastIndexedLedger(endLedger);
      logger.debug(`Processed ledger range ${startLedger}-${endLedger}`);

    } catch (error) {
      logger.error(`Failed to process ledger range ${startLedger}-${endLedger}:`, error);
      throw error;
    }
  }

  private async processTransaction(tx: Api.TransactionRecord): Promise<void> {
    try {
      // Get detailed transaction information
      const txDetails = await this.stellarServer.transactions().transaction(tx.hash).call();
      
      if (!txDetails.operations) return;

      for (const op of txDetails.operations) {
        if (op.type === 'invoke_contract_function') {
          await this.processContractOperation(op, tx);
        }
      }
    } catch (error) {
      logger.error(`Failed to process transaction ${tx.hash}:`, error);
    }
  }

  private async processContractOperation(operation: any, tx: Api.TransactionRecord): Promise<void> {
    try {
      const contractId = operation.contract_id?.toString();
      
      if (!contractId) {
        logger.debug('No contract ID found in operation');
        return;
      }

      // Check if this is one of our target contracts
      // For now, we'll index all contract events since the target contracts are not predefined
      const shouldIndex = this.TARGET_CONTRACTS.length === 0 || 
        this.TARGET_CONTRACTS.some(targetId => contractId === targetId);
      
      if (!shouldIndex) {
        logger.debug(`Skipping non-target contract: ${contractId}`);
        return;
      }

      // Extract events from the operation
      const events = this.extractEventsFromOperation(operation, contractId, tx);
      
      if (events.length === 0) {
        logger.debug(`No events found for contract ${contractId}`);
        return;
      }

      // Store events in database
      await this.storeEvents(events);
      logger.info(`Stored ${events.length} events for contract ${contractId}`);

    } catch (error) {
      logger.error('Failed to process contract operation:', error);
    }
  }

  private extractEventsFromOperation(operation: any, contractId: string, tx: Api.TransactionRecord): ContractEvent[] {
    const events: ContractEvent[] = [];
    
    try {
      // Stellar SDK may have events in different formats
      const operationEvents = operation.events || [];
      
      for (const event of operationEvents) {
        const eventType = this.getEventType(event);
        const eventId = this.generateEventId(event, tx.hash);
        
        events.push({
          event_id: eventId,
          contract_id: contractId,
          event_type: eventType,
          payload: event,
          ledger_sequence: parseInt(tx.ledger_attr || tx.ledger),
          tx_hash: tx.hash
        });
      }
    } catch (error) {
      logger.error('Failed to extract events from operation:', error);
    }
    
    return events;
  }

  private getEventType(event: any): string {
    // Extract event type based on the event structure
    if (event.type) return event.type;
    if (event.topic) return Array.isArray(event.topic) ? event.topic.join('.') : event.topic;
    if (event.event_type) return event.event_type;
    
    // Default to a generic type
    return 'contract_event';
  }

  private generateEventId(event: any, txHash: string): string {
    // Create a deterministic event ID
    const eventString = JSON.stringify(event);
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(`${txHash}-${eventString}`);
    return hash.digest('hex').substring(0, 64);
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
