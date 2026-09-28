import { Horizon } from '@stellar/stellar-sdk';
import { EventEmitter } from 'events';
import { createHorizonServer, getHorizonConfig, retryWithBackoff } from '../config/horizon.js';
import { webhookNotificationService } from './webhookNotificationService.js';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

export interface LedgerEvent {
  ledgerSequence: number;
  ledgerHash: string;
  closedAt: string;
  transactionCount: number;
  operationCount: number;
}

export interface OrgRelevantPayment {
  type: 'payment_received';
  transactionHash: string;
  ledger: number;
  from: string;
  to: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
  memo?: string;
  timestamp: string;
}

export interface OrgRelevantTrustline {
  type: 'trustline_created';
  transactionHash: string;
  ledger: number;
  account: string;
  assetCode: string;
  assetIssuer: string;
  timestamp: string;
}

export type OrgRelevantEvent = OrgRelevantPayment | OrgRelevantTrustline;

export class LedgerObserverService extends EventEmitter {
  private stream: any = null;
  private running = false;
  private watchedAddresses: Set<string> = new Set();
  private lastCursor: string = 'now';

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Ledger observer already running');
      return;
    }

    await this.loadWatchedAddresses();
    this.running = true;
    this.startStreaming();
    logger.info('Ledger observer started');
  }

  stop(): void {
    if (this.stream) {
      try {
        this.stream();
      } catch {
        // stream may not be a close function in all cases
      }
      this.stream = null;
    }
    this.running = false;
    logger.info('Ledger observer stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  async addWatchedAddress(address: string): Promise<void> {
    this.watchedAddresses.add(address);
    logger.info(`Watching address: ${address}`);
  }

  async removeWatchedAddress(address: string): Promise<void> {
    this.watchedAddresses.delete(address);
    logger.info(`Removed address from watch: ${address}`);
  }

  getWatchedAddresses(): string[] {
    return Array.from(this.watchedAddresses);
  }

  private async loadWatchedAddresses(): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT DISTINCT wallet_address FROM employees WHERE deleted_at IS NULL AND wallet_address IS NOT NULL`
      );
      for (const row of result.rows) {
        this.watchedAddresses.add(row.wallet_address);
      }
      logger.info(`Loaded ${this.watchedAddresses.size} watched addresses from employees`);

      const orgResult = await pool.query(
        `SELECT DISTINCT public_key FROM organizations WHERE public_key IS NOT NULL`
      );
      for (const row of orgResult.rows) {
        this.watchedAddresses.add(row.public_key);
      }
      logger.info(`Total watched addresses: ${this.watchedAddresses.size}`);
    } catch (error) {
      logger.error('Failed to load watched addresses', error);
    }
  }

  private startStreaming(): void {
    const server = createHorizonServer();

    const streamPayments = () => {
      if (!this.running) return;

      try {
        this.stream = server
          .payments()
          .cursor(this.lastCursor)
          .stream({
            onmessage: (payment: any) => {
              void this.handlePayment(payment);
            },
            onerror: (error: any) => {
              logger.error('Payment stream error', error);
              if (this.running) {
                logger.info('Reconnecting payment stream in 5s...');
                setTimeout(() => streamPayments(), 5000);
              }
            },
          });
      } catch (error: any) {
        logger.error('Failed to start payment stream', error);
        if (this.running) {
          setTimeout(() => streamPayments(), 5000);
        }
      }
    };

    streamPayments();

    // Also stream trustline changes via transactions
    const streamTrustlines = () => {
      if (!this.running) return;

      try {
        server
          .transactions()
          .cursor(this.lastCursor)
          .stream({
            onmessage: (tx: any) => {
              void this.handleTransaction(tx);
            },
            onerror: (error: any) => {
              logger.error('Transaction stream error', error);
              if (this.running) {
                setTimeout(() => streamTrustlines(), 5000);
              }
            },
          });
      } catch (error: any) {
        logger.error('Failed to start transaction stream', error);
        if (this.running) {
          setTimeout(() => streamTrustlines(), 5000);
        }
      }
    };

    streamTrustlines();
  }

  private async handlePayment(payment: any): Promise<void> {
    try {
      this.lastCursor = payment.paging_token || this.lastCursor;

      if (payment.type !== 'payment' && payment.type !== 'path_payment_strict_receive') {
        return;
      }

      const isRelevant =
        this.watchedAddresses.has(payment.to) ||
        this.watchedAddresses.has(payment.from);

      if (!isRelevant) return;

      const event: OrgRelevantPayment = {
        type: 'payment_received',
        transactionHash: payment.transaction_hash,
        ledger: parseInt(payment.source_ledger || '0', 10),
        from: payment.from,
        to: payment.to,
        amount: payment.amount,
        assetCode: payment.asset_type === 'native' ? 'XLM' : payment.asset_code,
        assetIssuer: payment.asset_issuer,
        timestamp: payment.created_at,
      };

      this.emit('payment', event);
      await this.dispatchWebhook('stellar.payment', event);
      logger.info(`Relevant payment detected: ${event.amount} ${event.assetCode} to ${event.to}`);
    } catch (error) {
      logger.error('Error handling payment event', error);
    }
  }

  private async handleTransaction(tx: any): Promise<void> {
    try {
      this.lastCursor = tx.paging_token || this.lastCursor;

      // Parse operations from the transaction envelope
      const operations = tx.operations?._embedded?.records || [];
      for (const op of operations) {
        if (op.type === 'change_trust' && op.asset_code) {
          const account = op.source_account || tx.source_account;
          if (this.watchedAddresses.has(account)) {
            const event: OrgRelevantTrustline = {
              type: 'trustline_created',
              transactionHash: tx.hash,
              ledger: tx.ledger_attr || 0,
              account,
              assetCode: op.asset_code,
              assetIssuer: op.asset_issuer,
              timestamp: tx.created_at,
            };

            this.emit('trustline', event);
            await this.dispatchWebhook('stellar.trustline_created', event);
            logger.info(`Trustline created: ${account} -> ${op.asset_code}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling transaction event', error);
    }
  }

  private async dispatchWebhook(eventType: string, payload: any): Promise<void> {
    try {
      // Find orgs that have this address in their employees or as their public key
      const orgIds = await this.findRelevantOrgs(payload.to || payload.from || payload.account);

      for (const orgId of orgIds) {
        try {
          await webhookNotificationService.dispatch(eventType, payload, orgId);
        } catch (error) {
          logger.error(`Failed to dispatch webhook for org ${orgId}`, error);
        }
      }
    } catch (error) {
      logger.error('Error dispatching webhook', error);
    }
  }

  private async findRelevantOrgs(address: string): Promise<number[]> {
    try {
      const result = await pool.query(
        `SELECT DISTINCT organization_id FROM employees WHERE wallet_address = $1 AND deleted_at IS NULL
         UNION
         SELECT id FROM organizations WHERE public_key = $1`,
        [address]
      );
      return result.rows.map((r: any) => r.organization_id || r.id);
    } catch {
      return [];
    }
  }

  async getHealthStatus(): Promise<{
    running: boolean;
    watchedAddresses: number;
    lastCursor: string;
    network: string;
  }> {
    const config = getHorizonConfig();
    return {
      running: this.running,
      watchedAddresses: this.watchedAddresses.size,
      lastCursor: this.lastCursor,
      network: config.network,
    };
  }
}

export const ledgerObserverService = new LedgerObserverService();
