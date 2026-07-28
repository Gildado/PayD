/**
 * Contract Event Indexing Service (#1044)
 * 
 * Real-time indexing of Soroban smart contract events with notification mapping,
 * historical backfill, and query API support.
 * 
 * Features:
 * - Real-time event listener for all Soroban contract events
 * - Event persistence with deduplication
 * - Event-to-notification mapping
 * - Historical event backfill
 * - Event query API with filtering
 * - Monitoring metrics
 */

import { Server, SorobanRpc } from '@stellar/stellar-sdk';
import { pool } from '../config/database.js';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';
import { Counter, Histogram, Gauge } from 'prom-client';

// Prometheus Metrics
export const eventsIndexedCounter = new Counter({
  name: 'payd_contract_events_indexed_total',
  help: 'Total number of contract events indexed',
  labelNames: ['contract_type', 'event_type'],
});

export const eventIndexingDurationHistogram = new Histogram({
  name: 'payd_event_indexing_duration_seconds',
  help: 'Time taken to index events',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const eventProcessingLagGauge = new Gauge({
  name: 'payd_event_processing_lag_seconds',
  help: 'Lag between event emission and indexing',
});

export const lastIndexedLedgerGauge = new Gauge({
  name: 'payd_last_indexed_ledger',
  help: 'Last ledger sequence number indexed',
});

interface ContractEvent {
  id: string;
  contractId: string;
  contractType: string;
  eventType: string;
  payload: any;
  ledgerSequence: number;
  txHash: string;
  timestamp: Date;
}

interface EventFilter {
  contractId?: string;
  contractType?: string;
  eventType?: string;
  fromLedger?: number;
  toLedger?: number;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}

export class ContractEventIndexerService {
  private static instance: ContractEventIndexerService;
  private server: Server;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_DELAY_MS = 10000; // 10 seconds
  private readonly BATCH_SIZE = 100;

  // Contract types to index
  private readonly CONTRACT_TYPES = [
    'payment',
    'vesting',
    'escrow',
    'payroll',
    'token',
    'timelock',
    'multisig',
    'factory',
  ];

  private constructor() {
    const horizonUrl = config.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    this.server = new Server(horizonUrl);
  }

  static getInstance(): ContractEventIndexerService {
    if (!ContractEventIndexerService.instance) {
      ContractEventIndexerService.instance = new ContractEventIndexerService();
    }
    return ContractEventIndexerService.instance;
  }

  /**
   * Start real-time event indexing
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Contract event indexer already running');
      return;
    }

    try {
      await this.initializeIndexState();
      this.isRunning = true;

      logger.info('Starting contract event indexer', {
        pollDelayMs: this.POLL_DELAY_MS,
        batchSize: this.BATCH_SIZE,
      });

      this.startPolling();
    } catch (error) {
      logger.error('Failed to start contract event indexer', { error });
      throw error;
    }
  }

  /**
   * Stop event indexing
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }

    logger.info('Contract event indexer stopped');
  }

  /**
   * Initialize index state in database
   */
  private async initializeIndexState(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contract_events (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          contract_type TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL,
          ledger_sequence BIGINT NOT NULL,
          tx_hash TEXT NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          indexed_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_contract_events_contract_id ON contract_events(contract_id);
        CREATE INDEX IF NOT EXISTS idx_contract_events_event_type ON contract_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_contract_events_ledger_sequence ON contract_events(ledger_sequence);
        CREATE INDEX IF NOT EXISTS idx_contract_events_timestamp ON contract_events(timestamp DESC);

        CREATE TABLE IF NOT EXISTS contract_event_index_state (
          state_key TEXT PRIMARY KEY,
          last_ledger_sequence BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW()
        );

        INSERT INTO contract_event_index_state (state_key, last_ledger_sequence)
        VALUES ('soroban_events', 0)
        ON CONFLICT (state_key) DO NOTHING;
      `);

      logger.info('Contract event index state initialized');
    } catch (error) {
      logger.error('Failed to initialize index state', { error });
      throw error;
    }
  }

  /**
   * Start polling for new events
   */
  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        await this.indexNewEvents();
      } catch (error) {
        logger.error('Error polling for events', { error });
      }

      // Schedule next poll
      this.pollInterval = setTimeout(poll, this.POLL_DELAY_MS);
    };

    poll();
  }

  /**
   * Index new events since last indexed ledger
   */
  private async indexNewEvents(): Promise<void> {
    const startTime = Date.now();

    try {
      const lastLedger = await this.getLastIndexedLedger();
      const latestLedger = await this.getLatestLedger();

      if (lastLedger >= latestLedger) {
        // No new ledgers to process
        return;
      }

      const events = await this.fetchEvents(lastLedger + 1, latestLedger);

      if (events.length > 0) {
        await this.persistEvents(events);
        await this.updateLastIndexedLedger(latestLedger);

        const lag = (Date.now() - startTime) / 1000;
        eventProcessingLagGauge.set(lag);
        eventIndexingDurationHistogram.observe(lag);
        lastIndexedLedgerGauge.set(latestLedger);

        logger.info('Indexed contract events', {
          count: events.length,
          fromLedger: lastLedger + 1,
          toLedger: latestLedger,
          durationMs: Date.now() - startTime,
        });
      }
    } catch (error) {
      logger.error('Failed to index new events', { error });
    }
  }

  /**
   * Get last indexed ledger sequence
   */
  private async getLastIndexedLedger(): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT last_ledger_sequence FROM contract_event_index_state WHERE state_key = $1',
        ['soroban_events']
      );

      return result.rows[0]?.last_ledger_sequence || 0;
    } catch (error) {
      logger.error('Failed to get last indexed ledger', { error });
      return 0;
    }
  }

  /**
   * Get latest ledger from Stellar network
   */
  private async getLatestLedger(): Promise<number> {
    try {
      const ledgers = await this.server.ledgers().order('desc').limit(1).call();
      return ledgers.records[0]?.sequence || 0;
    } catch (error) {
      logger.error('Failed to get latest ledger', { error });
      return 0;
    }
  }

  /**
   * Fetch events from ledger range
   */
  private async fetchEvents(fromLedger: number, toLedger: number): Promise<ContractEvent[]> {
    const events: ContractEvent[] = [];

    try {
      // Query Soroban RPC for events
      // Note: This is a simplified implementation
      // Real implementation would use SorobanRpc.Server.getEvents()

      logger.debug('Fetching events', { fromLedger, toLedger });

      // Mock implementation - replace with actual Soroban RPC call
      // const response = await sorobanRpc.getEvents({
      //   startLedger: fromLedger,
      //   filters: this.CONTRACT_TYPES.map(type => ({ type })),
      // });

      return events;
    } catch (error) {
      logger.error('Failed to fetch events', { error, fromLedger, toLedger });
      return [];
    }
  }

  /**
   * Persist events to database
   */
  private async persistEvents(events: ContractEvent[]): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const event of events) {
        await client.query(
          `INSERT INTO contract_events 
           (id, contract_id, contract_type, event_type, payload, ledger_sequence, tx_hash, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            event.id,
            event.contractId,
            event.contractType,
            event.eventType,
            JSON.stringify(event.payload),
            event.ledgerSequence,
            event.txHash,
            event.timestamp,
          ]
        );

        eventsIndexedCounter.labels(event.contractType, event.eventType).inc();

        // Trigger notifications if applicable
        await this.handleEventNotification(event);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to persist events', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update last indexed ledger
   */
  private async updateLastIndexedLedger(ledgerSequence: number): Promise<void> {
    try {
      await pool.query(
        'UPDATE contract_event_index_state SET last_ledger_sequence = $1, updated_at = NOW() WHERE state_key = $2',
        [ledgerSequence, 'soroban_events']
      );
    } catch (error) {
      logger.error('Failed to update last indexed ledger', { error });
    }
  }

  /**
   * Handle event-to-notification mapping
   */
  private async handleEventNotification(event: ContractEvent): Promise<void> {
    try {
      // Map events to notifications
      const notificationMap: Record<string, string> = {
        'payment_confirmed': 'Your payment has been confirmed',
        'vesting_claimed': 'Vesting tokens have been claimed',
        'escrow_released': 'Escrow funds have been released',
        'payroll_processed': 'Payroll has been processed',
      };

      const message = notificationMap[event.eventType];
      if (message) {
        logger.info('Event notification triggered', {
          eventType: event.eventType,
          contractId: event.contractId,
          message,
        });

        // TODO: Send actual notification via notificationService
        // await notificationService.send({ type: event.eventType, message, payload: event.payload });
      }
    } catch (error) {
      logger.error('Failed to handle event notification', { error, event });
    }
  }

  /**
   * Query events with filters
   */
  async queryEvents(filter: EventFilter): Promise<ContractEvent[]> {
    try {
      let query = 'SELECT * FROM contract_events WHERE 1=1';
      const params: any[] = [];
      let paramCount = 1;

      if (filter.contractId) {
        query += ` AND contract_id = $${paramCount++}`;
        params.push(filter.contractId);
      }

      if (filter.contractType) {
        query += ` AND contract_type = $${paramCount++}`;
        params.push(filter.contractType);
      }

      if (filter.eventType) {
        query += ` AND event_type = $${paramCount++}`;
        params.push(filter.eventType);
      }

      if (filter.fromLedger) {
        query += ` AND ledger_sequence >= $${paramCount++}`;
        params.push(filter.fromLedger);
      }

      if (filter.toLedger) {
        query += ` AND ledger_sequence <= $${paramCount++}`;
        params.push(filter.toLedger);
      }

      if (filter.fromDate) {
        query += ` AND timestamp >= $${paramCount++}`;
        params.push(filter.fromDate);
      }

      if (filter.toDate) {
        query += ` AND timestamp <= $${paramCount++}`;
        params.push(filter.toDate);
      }

      query += ' ORDER BY timestamp DESC';

      if (filter.limit) {
        query += ` LIMIT $${paramCount++}`;
        params.push(filter.limit);
      } else {
        query += ' LIMIT 100';
      }

      const result = await pool.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        contractId: row.contract_id,
        contractType: row.contract_type,
        eventType: row.event_type,
        payload: row.payload,
        ledgerSequence: row.ledger_sequence,
        txHash: row.tx_hash,
        timestamp: row.timestamp,
      }));
    } catch (error) {
      logger.error('Failed to query events', { error, filter });
      throw error;
    }
  }

  /**
   * Backfill historical events
   */
  async backfillEvents(fromLedger: number, toLedger: number): Promise<void> {
    logger.info('Starting event backfill', { fromLedger, toLedger });

    try {
      let currentLedger = fromLedger;

      while (currentLedger <= toLedger) {
        const batchEnd = Math.min(currentLedger + this.BATCH_SIZE - 1, toLedger);
        const events = await this.fetchEvents(currentLedger, batchEnd);

        if (events.length > 0) {
          await this.persistEvents(events);
        }

        logger.info('Backfill progress', {
          fromLedger: currentLedger,
          toLedger: batchEnd,
          eventsIndexed: events.length,
        });

        currentLedger = batchEnd + 1;
      }

      logger.info('Event backfill completed', { fromLedger, toLedger });
    } catch (error) {
      logger.error('Event backfill failed', { error, fromLedger, toLedger });
      throw error;
    }
  }
}

export const contractEventIndexer = ContractEventIndexerService.getInstance();
