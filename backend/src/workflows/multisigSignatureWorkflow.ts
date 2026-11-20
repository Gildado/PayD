// src/workflows/multisigSignatureWorkflow.ts
import { Workflow, Step } from '@mastra/core';
import { multiSigService } from '../services/multiSigService';
import { Logger } from '@nestjs/common';

const logger = new Logger('MultisigSignatureWorkflow');

// Step 1: Validate transaction and check current signature status
const checkSignatureStatusStep = new Step({
  id: 'checkSignatureStatus',
  execute: async ({ inputData }) => {
    logger.log(`Checking signature collection status for multisig transaction: ${inputData.transactionId}`);
    const status = await multiSigService.getSignatureStatus(inputData.transactionId);

    if (!status) {
      throw new Error(`Transaction not found or invalid ID: ${inputData.transactionId}`);
    }

    return { ...inputData, currentSignatures: status.signaturesCount, requiredSignatures: status.requiredCount };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
});

// Step 2: Request missing signatures or finalize collection if threshold met
const processSignatureCollectionStep = new Step({
  id: 'processSignatureCollection',
  execute: async ({ inputData }) => {
    logger.log(`Processing signature collection for transaction ${inputData.transactionId} (${inputData.currentSignatures}/${inputData.requiredSignatures})`);

    if (inputData.currentSignatures >= inputData.requiredSignatures) {
      const finalizationResult = await multiSigService.finalizeTransaction(inputData.transactionId);
      return { status: 'COMPLETED', finalizationResult };
    } else {
      const reminderResult = await multiSigService.dispatchSignatureReminders(inputData.transactionId);
      return { status: 'PENDING_SIGNATURES', reminderResult };
    }
  },
  retryConfig: {
    attempts: 2,
    delay: 2000,
  },
});

// Assemble the Mastra Workflow
export const multisigSignatureWorkflow = new Workflow({
  name: 'multisig-signature-collection-orchestration',
  steps: [checkSignatureStatusStep, processSignatureCollectionStep],
});

multisigSignatureWorkflow
  .then(checkSignatureStatusStep)
  .then(processSignatureCollectionStep);