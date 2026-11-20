import { Workflow, Step } from '@mastra/core';
import { freezeService } from '../services/freezeService';
import { Logger } from '@nestjs/common';

const logger = new Logger('AccountFreezeWorkflow');

// Step 1: Check pending transactions and account eligibility for freezing
const checkAccountEligibilityStep = new Step({
  id: 'checkAccountEligibility',
  execute: async ({ inputData }) => {
    logger.log(`Checking freeze eligibility and pending transactions for account: ${inputData.accountId}`);
    const eligibility = await freezeService.checkPendingTransactions(inputData.accountId);

    if (eligibility.hasBlockingPendingTransactions && !inputData.forceFreeze) {
      throw new Error(`Freeze aborted: Account has unsettled pending transactions that require resolution.`);
    }

    return { ...inputData, eligibilityChecked: true };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
});

// Step 2: Execute account freeze and dispatch notifications
const executeAccountFreezeStep = new Step({
  id: 'executeAccountFreeze',
  execute: async ({ inputData }) => {
    logger.log(`Executing account freeze for account: ${inputData.accountId}, reason: ${inputData.reason}`);
    const freezeResult = await freezeService.freezeAccount({
      accountId: inputData.accountId,
      reason: inputData.reason,
      performedBy: inputData.performedBy,
    });

    if (!freezeResult || !freezeResult.success) {
      throw new Error(`Account freeze execution failed on service layer.`);
    }

    return { success: true, accountId: inputData.accountId, freezeResult };
  },
  retryConfig: {
    attempts: 2,
    delay: 2000,
  },
});

// Assemble the Mastra Workflow
export const accountFreezeWorkflow = new Workflow({
  name: 'account-freeze-orchestration',
  steps: [checkAccountEligibilityStep, executeAccountFreezeStep],
});

accountFreezeWorkflow
  .then(checkAccountEligibilityStep)
  .then(executeAccountFreezeStep);