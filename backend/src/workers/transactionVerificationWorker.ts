import { Worker, Job } from 'bullmq';
import { redisConnection, TX_VERIFICATION_QUEUE_NAME } from '../config/queue.js';
import { TxVerificationJobData } from '../services/transactionVerificationQueueService.js';
import { TransactionAuditService } from '../services/transactionAuditService.js';
import logger from '../utils/logger.js';

function isHorizonNotFound(error: any): boolean {
  const status = error?.response?.status;
  // stellar-sdk Horizon call() errors typically include response.status
  return status === 404;
}

/**
 * Worker that verifies submitted tx hashes on-chain via Horizon and stores an
 * immutable record in transaction_audit_logs.
 *
 * The queue is intentionally retry-heavy: Horizon indexing can lag, and
 * Soroban transactions may not be visible immediately.
 */
export const transactionVerificationWorker = new Worker<TxVerificationJobData>(
  TX_VERIFICATION_QUEUE_NAME,
  async (job: Job<TxVerificationJobData>) => {
    const { txHash, source, organizationId } = job.data;

    logger.info('Processing tx verification job', {
      jobId: job.id,
      txHash,
      source: source ?? 'unknown',
      organizationId,
      attempt: job.attemptsMade,
    });

    try {
      const record = await TransactionAuditService.fetchAndStore(txHash);

      logger.info('Tx verified and stored', {
        jobId: job.id,
        txHash,
        ledger: record.ledger_sequence,
        successful: record.successful,
        source: source ?? 'unknown',
      });

      return;
    } catch (error: any) {
      if (isHorizonNotFound(error)) {
        // Trigger retry with backoff; tx may not be indexed yet.
        logger.warn('Tx not yet available on Horizon (will retry)', {
          jobId: job.id,
          txHash,
          source: source ?? 'unknown',
          attempt: job.attemptsMade,
        });
        throw error;
      }

      logger.error('Tx verification failed', {
        jobId: job?.id,
        txHash,
        source: source ?? 'unknown',
        attempt: job.attemptsMade,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

transactionVerificationWorker.on('completed', (job) => {
  logger.info('Tx verification job completed', {
    jobId: job.id,
    txHash: job.data.txHash,
    source: job.data.source ?? 'unknown',
  });
});

transactionVerificationWorker.on('failed', (job, err) => {
  logger.error('Tx verification job failed', {
    jobId: job?.id,
    txHash: job?.data?.txHash,
    source: job?.data?.source ?? 'unknown',
    attemptsMade: job?.attemptsMade,
    error: err.message,
  });
});

