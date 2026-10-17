// #1281 — Transaction verification stuck-item detection workflow
import { Workflow, Step } from '@mastra/core';
import { Logger } from '@nestjs/common';

const logger = new Logger('TransactionStuckDetectionWorkflow');

const scanStuckTransactionsStep = new Step({
  id: 'scanStuckTransactions',
  execute: async ({ inputData }) => {
    logger.log('Scanning for stuck transactions in verification queue');
    const stuckThresholdMs = inputData?.stuckThresholdMs ?? 30 * 60 * 1000; // 30 min default
    const now = Date.now();

    // Query for transactions stuck in 'pending' or 'verifying' state past threshold
    // This would call transactionVerificationQueueService
    return {
      ...inputData,
      stuckThresholdMs,
      scannedAt: new Date().toISOString(),
      stuckItems: [], // populated by actual service call
    };
  },
  retryConfig: { attempts: 3, delay: 5000 },
});

const categorizeStuckItemsStep = new Step({
  id: 'categorizeStuckItems',
  execute: async ({ inputData }) => {
    logger.log(`Categorizing ${inputData.stuckItems?.length ?? 0} stuck items`);
    const items = inputData.stuckItems ?? [];
    const categorized = items.map((item: any) => ({
      ...item,
      category: item.attempts >= 3 ? 'exhausted' : 'retryable',
    }));
    return { ...inputData, categorized };
  },
});

const requeueRetryableStep = new Step({
  id: 'requeueRetryable',
  execute: async ({ inputData }) => {
    const retryable = (inputData.categorized ?? []).filter((i: any) => i.category === 'retryable');
    logger.log(`Requeuing ${retryable.length} retryable stuck transactions`);
    // Requeue logic goes here
    return { ...inputData, requeuedCount: retryable.length };
  },
  retryConfig: { attempts: 2, delay: 3000 },
});

const alertExhaustedStep = new Step({
  id: 'alertExhausted',
  execute: async ({ inputData }) => {
    const exhausted = (inputData.categorized ?? []).filter((i: any) => i.category === 'exhausted');
    if (exhausted.length > 0) {
      logger.warn(`Alerting on ${exhausted.length} exhausted stuck transactions`);
    }
    return {
      success: true,
      totalScanned: inputData.stuckItems?.length ?? 0,
      requeued: inputData.requeuedCount ?? 0,
      alerted: exhausted.length,
      completedAt: new Date().toISOString(),
    };
  },
});

export const transactionStuckDetectionWorkflow = new Workflow({
  name: 'transaction-stuck-detection',
  steps: [scanStuckTransactionsStep, categorizeStuckItemsStep, requeueRetryableStep, alertExhaustedStep],
});

transactionStuckDetectionWorkflow
  .then(scanStuckTransactionsStep)
  .then(categorizeStuckItemsStep)
  .then(requeueRetryableStep)
  .then(alertExhaustedStep);
