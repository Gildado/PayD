// src/workflows/multisigEscalationWorkflow.ts
import { Workflow, Step } from '@mastra/core';
import { multiSigService } from '../services/multiSigService';
import { notificationService } from '../services/notificationService';
import { Logger } from '@nestjs/common';

const logger = new Logger('MultisigEscalationWorkflow');

// Step 1: Check for stalled multisig transactions past timeout threshold
const checkStalledApprovalsStep = new Step({
  id: 'checkStalledApprovals',
  execute: async ({ inputData }) => {
    logger.log(`Checking stalled multisig approvals for wallet: ${inputData.walletId}`);
    const stalledTxns = await multiSigService.getStalledTransactions({
      walletId: inputData.walletId,
      timeoutHours: inputData.timeoutHours || 24,
    });

    if (!stalledTxns || stalledTxns.length === 0) {
      return { ...inputData, stalledTxns: [], escalated: false };
    }

    return { ...inputData, stalledTxns };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
});

// Step 2: Escalate to remaining signers or fallback admins
const escalateToSignersStep = new Step({
  id: 'escalateToSigners',
  execute: async ({ inputData }) => {
    if (!inputData.stalledTxns || inputData.stalledTxns.length === 0) {
      return { status: 'No stalled approvals to escalate' };
    }

    logger.log(`Escalating ${inputData.stalledTxns.length} stalled transactions to backup signers/admins.`);
    const escalationResults = [];

    for (const tx of inputData.stalledTxns) {
      const pendingSigners = await multiSigService.getPendingSigners(tx.id);
      
      if (!pendingSigners || pendingSigners.length === 0) {
        throw new Error(`Escalation failed: No pending signers found for stalled transaction ${tx.id}`);
      }

      await notificationService.sendMultisigAlert({
        transactionId: tx.id,
        recipients: pendingSigners,
        urgency: 'HIGH',
      });

      escalationResults.push({ transactionId: tx.id, notifiedSigners: pendingSigners.length });
    }

    return { status: 'Escalated successfully', escalationResults };
  },
  retryConfig: {
    attempts: 2,
    delay: 2000,
  },
});

// Assemble the Mastra Workflow
export const multisigEscalationWorkflow = new Workflow({
  name: 'multisig-approval-timeout-escalation',
  steps: [checkStalledApprovalsStep, escalateToSignersStep],
});

multisigEscalationWorkflow
  .then(checkStalledApprovalsStep)
  .then(escalateToSignersStep);