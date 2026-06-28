/**
 * Payroll Worker - Background processor for executing payroll runs
 * 
 * This worker handles the complex orchestration of payroll payments on the Stellar blockchain.
 * It processes payroll runs asynchronously using BullMQ, ensuring reliable payment distribution
 * with proper error handling, progress tracking, and audit logging.
 * 
 * Key Responsibilities:
 * 1. Validate payroll run data and employee wallet addresses
 * 2. Perform preflight balance checks to prevent insufficient fund errors
 * 3. Calculate and apply tax deductions per organization rules
 * 4. Batch payments into Stellar transaction chunks (max 100 operations per tx)
 * 5. Submit transactions to Stellar network with proper signing
 * 6. Track progress and emit real-time updates via WebSocket
 * 7. Log comprehensive audit trails for compliance
 * 8. Trigger notifications and webhooks for payment events
 * 
 * @module workers/payrollWorker
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, PAYROLL_QUEUE_NAME } from '../config/queue.js';
import { PayrollBonusService } from '../services/payrollBonusService.js';
import { PayrollJobData } from '../services/payrollQueueService.js';
import { StellarService } from '../services/stellarService.js';
import { PayrollAuditService } from '../services/payrollAuditService.js';
import { emitBulkUpdate } from '../services/socketService.js';
import { BalanceService } from '../services/balanceService.js';
import { webhookNotificationService } from '../services/webhookNotificationService.js';
import { NotificationQueueService } from '../services/notificationQueueService.js';
import { TransactionVerificationQueueService } from '../services/transactionVerificationQueueService.js';
import taxService from '../services/taxService.js';
import logger from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { Keypair, Asset, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { getAssetIssuer } from '../config/assets.js';

/**
 * Initialize notification and transaction verification queue services
 * These services handle async operations that don't block the main payroll flow
 */
const notificationQueueService = new NotificationQueueService();
const txVerificationQueueService = TransactionVerificationQueueService;

/**
 * Payroll Worker Instance
 * 
 * Processes payroll jobs from the BullMQ queue with the following workflow:
 * 
 * PHASE 1: INITIALIZATION & VALIDATION
 * - Fetch payroll run details and associated payment items
 * - Validate employee wallet addresses
 * - Update run status to 'processing'
 * 
 * PHASE 2: PREFLIGHT CHECKS
 * - Verify distribution account has sufficient balance (for ORGUSD)
 * - Calculate total required funds including all payments
 * - Abort early if insufficient funds to prevent partial payments
 * 
 * PHASE 3: TAX CALCULATION
 * - Apply organization-specific tax rules to each payment
 * - Calculate gross amount, deductions, and net payout
 * - Record deductions for compliance reporting
 * 
 * PHASE 4: TRANSACTION BATCHING
 * - Group payments into chunks of 100 (Stellar's operation limit per transaction)
 * - Build Stellar payment operations for each chunk
 * - Sign and submit transactions to the network
 * 
 * PHASE 5: POST-PROCESSING
 * - Update payment item statuses in database
 * - Log audit entries for compliance
 * - Enqueue notification jobs for employees
 * - Emit real-time progress updates via WebSocket
 * - Trigger webhook notifications for external systems
 * 
 * ERROR HANDLING:
 * - Chunk-level failures: Mark affected items as failed, log errors, retry via BullMQ
 * - Critical failures: Mark entire run as failed, emit failure events, trigger webhooks
 * - Non-blocking failures: Log warnings but continue processing (e.g., notification enqueue failures)
 * 
 * @param job - BullMQ job containing payrollRunId
 * @returns Promise that resolves when payroll processing completes
 */
export const payrollWorker = new Worker<PayrollJobData>(
  PAYROLL_QUEUE_NAME,
  async (job: Job<PayrollJobData>) => {
    const { payrollRunId } = job.data;
    logger.info(`Processing payroll run ${payrollRunId} (Job: ${job.id})`);

    try {
      // ========================================
      // PHASE 1: INITIALIZATION & VALIDATION
      // ========================================
      
      // Fetch the complete payroll run with all payment items
      // This includes employee details, amounts, wallet addresses, and metadata
      const summary = await PayrollBonusService.getPayrollRunSummary(payrollRunId);
      if (!summary) {
        throw new Error(`Payroll run ${payrollRunId} not found`);
      }

      const { payroll_run, items } = summary;
      const batchId = payroll_run.batch_id;

      // Update status to 'processing' and notify connected clients via WebSocket
      // This allows real-time UI updates in the employer dashboard
      await PayrollBonusService.updatePayrollRunStatus(payrollRunId, 'processing');
      emitBulkUpdate(batchId, 'processing', { progress: 0 });

      // ========================================
      // PHASE 2: PREFLIGHT CHECKS
      // ========================================
      
      // Load the distribution account keypair from environment
      // This account holds the organization's funds and signs all payment transactions
      const distributionSecret = process.env.ORGUSD_DISTRIBUTION_SECRET;
      if (!distributionSecret) {
        throw new Error('ORGUSD_DISTRIBUTION_SECRET not configured on server');
      }

      const distributionKeypair = Keypair.fromSecret(distributionSecret);
      const assetCode = payroll_run.asset_code;
      const assetIssuer = assetCode !== 'XLM' ? getAssetIssuer(assetCode) : null;

      // Preflight balance check for ORGUSD payroll runs
      // This prevents partial payment failures by verifying sufficient funds upfront
      // For other assets (like XLM), balance checks happen at transaction submission
      if (assetCode === 'ORGUSD') {
        if (!assetIssuer) {
          throw new Error('ORGUSD_ISSUER_PUBLIC not configured on server');
        }

        // Prepare payment summary for balance verification
        const preflightPayments = items.map((item) => ({
          employeeId: String(item.employee_id),
          employeeName:
            `${item.employee_first_name ?? ''} ${item.employee_last_name ?? ''}`.trim() ||
            item.employee_email ||
            `Employee #${item.employee_id}`,
          walletAddress: item.employee_wallet_address || 'N/A',
          amount: item.amount,
        }));

        // Check if distribution account has enough ORGUSD to cover all payments
        const preflightResult = await BalanceService.preflightCheck(
          distributionKeypair.publicKey(),
          assetCode,
          assetIssuer,
          preflightPayments
        );

        // If insufficient funds, abort the entire payroll run
        // This prevents partial payments which could cause accounting issues
        if (!preflightResult.sufficient) {
          const shortfallReport = {
            payrollRunId,
            batchId,
            organizationId: payroll_run.organization_id,
            generatedAt: new Date().toISOString(),
            ...preflightResult,
          };

          // Notify organization via webhook about insufficient balance
          await webhookNotificationService.dispatch(
            'balance.low',
            {
              message: 'Payroll aborted due to insufficient ORGUSD distribution balance.',
              shortfallReport,
            },
            payroll_run.organization_id
          );

          // Emit failure event to connected clients
          emitBulkUpdate(batchId, 'failed', {
            error: 'Insufficient ORGUSD balance. Payroll aborted before execution.',
            shortfallReport,
          });

          throw new Error(
            `Insufficient ORGUSD balance for payroll run ${payrollRunId}. ` +
              `Required: ${preflightResult.totalRequired}, Available: ${preflightResult.availableBalance}, ` +
              `Shortfall: ${preflightResult.shortfall}`
          );
        }
      }

      // Create Stellar Asset object for payment operations
      // XLM uses native asset, custom assets require issuer address
      const asset = assetCode === 'XLM' ? Asset.native() : new Asset(assetCode, assetIssuer!);

      // ========================================
      // PHASE 3: TRANSACTION BATCHING
      // ========================================
      
      // Stellar transactions are limited to 100 operations each
      // We batch payment items into chunks to respect this limit
      // Each chunk becomes a separate transaction on the blockchain
      const chunkSize = 100;
      const itemChunks = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        itemChunks.push(items.slice(i, i + chunkSize));
      }

      let completedCount = 0;
      const totalItems = items.length;

      // Process each chunk sequentially to maintain order and simplify error handling
      for (let i = 0; i < itemChunks.length; i++) {
        const chunk = itemChunks[i]!;
        logger.info(`Processing chunk ${i + 1}/${itemChunks.length} for run ${payrollRunId}`);

        try {
          const operations = [];
          
          // ========================================
          // PHASE 4: TAX CALCULATION & OPERATION BUILDING
          // ========================================

          for (const item of chunk) {
            // Validate employee has a wallet address configured
            if (!item.employee_wallet_address) {
              throw new Error(`Employee ${item.employee_id} has no wallet address`);
            }

            // Calculate tax deductions based on organization's tax rules
            // This applies federal, state, and local tax rates as configured
            const taxResult = await taxService.calculateDeductions(
              payroll_run.organization_id,
              parseFloat(item.amount)
            );

            // Log tax calculations for transparency and debugging
            if (taxResult.total_tax > 0) {
              logger.info(`Applying tax deductions for employee ${item.employee_id}: Gross ${taxResult.gross_amount}, Tax ${taxResult.total_tax}, Net ${taxResult.net_amount}`);
              
              // Record each deduction separately for detailed tax reporting
              // This creates an audit trail for compliance with tax regulations
              for (const deduction of taxResult.deductions) {
                await taxService.recordDeduction(
                  payroll_run.organization_id,
                  item.employee_id,
                  null,
                  deduction.rule_id,
                  taxResult.gross_amount,
                  deduction.deducted_amount,
                  taxResult.net_amount,
                  payroll_run.period_start.toISOString(),
                  payroll_run.period_end.toISOString()
                );
              }
            }

            // Create Stellar payment operation with net amount (after tax deductions)
            // Each operation transfers funds from distribution account to employee wallet
            operations.push(
              Operation.payment({
                destination: item.employee_wallet_address,
                asset: asset,
                amount: taxResult.net_amount.toString(),
              })
            );
          }

          // ========================================
          // PHASE 5: TRANSACTION SUBMISSION
          // ========================================
          
          // Build and submit the Stellar transaction for this chunk
          const server = StellarService.getServer();
          const networkPassphrase = StellarService.getNetworkPassphrase();
          
          // Load the current state of the distribution account from Stellar
          // This includes the sequence number needed for transaction ordering
          const account = await server.loadAccount(distributionKeypair.publicKey());

          // Create transaction builder with appropriate fee
          // Fee is calculated as 1000 stroops per operation (Stellar's base fee)
          const txBuilder = new TransactionBuilder(account, {
            fee: (1000 * operations.length).toString(),
            networkPassphrase,
          });

          // Add all payment operations to the transaction
          operations.forEach((op) => txBuilder.addOperation(op));
          
          // Set transaction timeout to 3 minutes
          // If not included in a ledger within this time, the transaction expires
          txBuilder.setTimeout(180);

          // Build, sign, and submit the transaction
          const tx = txBuilder.build();
          tx.sign(distributionKeypair);

          const result = await withRetry(
            () => StellarService.submitTransaction(tx),
            3,
            500
          );
          logger.info(`Chunk ${i + 1} submitted successfully. Tx Hash: ${result.hash}`);

          // ========================================
          // PHASE 6: POST-PROCESSING & AUDIT LOGGING
          // ========================================
          
          // Enqueue transaction verification job (async, non-blocking)
          // This verifies the transaction was actually included in the ledger
          try {
            await txVerificationQueueService.enqueue({
              txHash: result.hash,
              source: 'payroll',
              organizationId: payroll_run.organization_id,
            });
          } catch (enqueueError) {
            // Log warning but don't fail the payroll - verification is supplementary
            logger.warn('Failed to enqueue tx verification (continuing)', {
              txHash: result.hash,
              error: enqueueError instanceof Error ? enqueueError.message : 'Unknown error',
            });
          }

          // Update database and create audit logs for each payment in this chunk
          for (const item of chunk) {
            // Mark payment item as completed with transaction hash
            await PayrollBonusService.updateItemStatus(item.id, 'completed', result.hash);
            
            // Create immutable audit log entry for compliance
            // This records who was paid, how much, when, and the blockchain proof
            await PayrollAuditService.logTransactionSucceeded(
              payroll_run.organization_id,
              payrollRunId,
              item.id,
              item.employee_id,
              result.hash,
              result.ledger || 0,
              item.amount,
              assetCode,
              item.item_type
            );
            
            // Enqueue notification job to inform employee of payment
            // This is async and non-blocking - failures don't affect payroll
            try {
              await notificationQueueService.enqueuePaymentNotification({
                transactionId: item.id,
                transactionHash: result.hash,
                employeeId: item.employee_id,
                organizationId: payroll_run.organization_id,
                amount: item.amount,
                assetCode: assetCode,
                timestamp: new Date().toISOString(),
              });
            } catch (notificationError) {
              // Log error but don't fail the payroll processing
              // Notifications are important but not critical to payment success
              logger.error('Failed to enqueue notification', {
                transactionId: item.id,
                employeeId: item.employee_id,
                error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
              });
            }
            
            completedCount++;
          }

          // Emit real-time progress update via WebSocket
          // This updates the UI progress bar in the employer dashboard
          const progress = Math.round((completedCount / totalItems) * 100);
          emitBulkUpdate(batchId, 'processing', {
            progress,
            completedCount,
            totalItems,
            lastTxHash: result.hash
          });

        } catch (chunkError: any) {
          // ========================================
          // CHUNK-LEVEL ERROR HANDLING
          // ========================================
          
          logger.error(`Failed to process chunk ${i + 1} for run ${payrollRunId}`, chunkError);

          // Mark all items in failed chunk as failed
          // This allows for targeted retry of just the failed payments
          for (const item of chunk) {
            await PayrollBonusService.updateItemStatus(item.id, 'failed');
            
            // Log failure in audit trail with error details
            await PayrollAuditService.logTransactionFailed(
              payroll_run.organization_id,
              payrollRunId,
              item.id,
              item.employee_id,
              'N/A',
              chunkError.message || 'Unknown error',
              item.amount,
              assetCode,
              item.item_type
            );
          }

          // Re-throw error to trigger BullMQ retry mechanism
          // BullMQ will retry the entire job based on configured retry policy
          throw chunkError;
        }
      }

      // ========================================
      // PHASE 7: COMPLETION
      // ========================================
      
      // Mark payroll run as completed
      await PayrollBonusService.updatePayrollRunStatus(payrollRunId, 'completed');
      emitBulkUpdate(batchId, 'completed', { progress: 100, completedCount: totalItems });
      
      // Dispatch completion webhook to external systems
      // This allows integration with accounting software, HR systems, etc.
      void webhookNotificationService.dispatch('payroll.completed', {
        payrollRunId,
        batchId,
        organizationId: payroll_run.organization_id,
        completedCount: totalItems,
        assetCode
      }, payroll_run.organization_id);

      logger.info(`Successfully completed payroll run ${payrollRunId}`);
      
    } catch (error: any) {
      // ========================================
      // CRITICAL ERROR HANDLING
      // ========================================
      
      logger.error(`Critical failure in payroll worker for run ${payrollRunId}`, error);

      // Mark entire payroll run as failed
      await PayrollBonusService.updatePayrollRunStatus(payrollRunId, 'failed');

      const summary = await PayrollBonusService.getPayrollRunSummary(payrollRunId);
      if (summary) {
        // Emit failure event to connected clients
        emitBulkUpdate(summary.payroll_run.batch_id, 'failed', {
          error: error.message,
        });

        // Dispatch failure webhook for external monitoring/alerting
        void webhookNotificationService.dispatch('payroll.failed', {
          payrollRunId,
          batchId: summary.payroll_run.batch_id,
          organizationId: summary.payroll_run.organization_id,
          error: error.message || 'Unknown error'
        }, summary.payroll_run.organization_id);
      }

      // Re-throw to let BullMQ handle retry logic
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process one payroll run at a time to prevent race conditions
  }
);

/**
 * Event handler for successful job completion
 * Logs completion for monitoring and debugging
 */
payrollWorker.on('completed', (job) => {
  logger.info(`Payroll job ${job.id} completed successfully`);
});

/**
 * Event handler for job failures
 * Logs errors for monitoring and alerting
 */
payrollWorker.on('failed', (job, err) => {
  logger.error(`Payroll job ${job?.id} failed with error: ${err.message}`);
});
