/**
 * SEP-31 Tracking Orchestration Workflow
 * Links status updates to notifications with retries, exponential backoff, and tracing.
 */

import { Sep31TrackingService, Sep31Transaction } from './sep31TrackingService.js';

export interface WorkflowOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  notificationCallback?: (tx: Sep31Transaction) => Promise<void>;
  logger?: { info: (msg: string, meta?: any) => void; error: (msg: string, meta?: any) => void };
}

export class Sep31TrackingWorkflow {
  private trackingService: Sep31TrackingService;
  private maxRetries: number;
  private initialDelayMs: number;
  private notificationCallback?: (tx: Sep31Transaction) => Promise<void>;
  private logger: { info: (msg: string, meta?: any) => void; error: (msg: string, meta?: any) => void };

  constructor(trackingService: Sep31TrackingService, options: WorkflowOptions = {}) {
    this.trackingService = trackingService;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 100;
    this.notificationCallback = options.notificationCallback;
    this.logger = options.logger ?? {
      info: (msg, meta) => console.log(`[INFO] ${msg}`, meta ?? ''),
      error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ''),
    };
  }

  async executeWorkflow(transactionId: string, targetStatus: Sep31Transaction['status'], stellarTxHash?: string, errorMessage?: string): Promise<Sep31Transaction> {
    this.logger.info(`Starting SEP-31 tracking workflow for transaction ${transactionId} -> ${targetStatus}`, { transactionId, targetStatus });

    let attempt = 0;
    let lastError: any;

    while (attempt <= this.maxRetries) {
      try {
        // Step 1: Update transaction status
        const updatedTx = await this.trackingService.updateStatus(transactionId, targetStatus, stellarTxHash, errorMessage);
        this.logger.info(`Successfully updated transaction status`, { transactionId, status: targetStatus, attempt });

        // Step 2: Trigger notification if callback provided
        if (this.notificationCallback) {
          await this.notifyWithRetry(updatedTx);
        }

        return updatedTx;
      } catch (err: any) {
        lastError = err;
        attempt++;
        this.logger.error(`Workflow step failed (attempt ${attempt}/${this.maxRetries + 1})`, { transactionId, error: err.message });

        if (attempt > this.maxRetries) {
          break;
        }

        const delay = this.initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`SEP-31 workflow failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`);
  }

  private async notifyWithRetry(tx: Sep31Transaction): Promise<void> {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        if (this.notificationCallback) {
          await this.notificationCallback(tx);
          this.logger.info(`Notification dispatched successfully`, { transactionId: tx.id });
          return;
        }
      } catch (err: any) {
        attempt++;
        this.logger.error(`Notification dispatch failed (attempt ${attempt})`, { transactionId: tx.id, error: err.message });
        if (attempt > this.maxRetries) throw err;
        await new Promise((resolve) => setTimeout(resolve, this.initialDelayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
}
