// src/workflows/taxWithholdingWorkflow.ts
import { Workflow, Step } from '@mastra/core';
import { taxService } from '../services/taxService';
import { Logger } from '@nestjs/common';

const logger = new Logger('TaxWithholdingWorkflow');

// Step 1: Fetch and validate jurisdiction rules for employee location
const fetchJurisdictionRulesStep = new Step({
  id: 'fetchJurisdictionRules',
  execute: async ({ inputData }) => {
    logger.log(`Fetching tax withholding rules for jurisdiction: ${inputData.jurisdiction}`);
    const rules = await taxService.getJurisdictionRules(inputData.jurisdiction);
    if (!rules) {
      throw new Error(`Tax rules not found for jurisdiction: ${inputData.jurisdiction}`);
    }
    return { ...inputData, rules };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
});

// Step 2: Calculate withholding brackets and deductions
const calculateWithholdingStep = new Step({
  id: 'calculateWithholding',
  execute: async ({ inputData }) => {
    logger.log(`Calculating tax withholding for employee: ${inputData.employeeId} with gross pay: ${inputData.grossPay}`);
    const calculation = await taxService.computeWithholding({
      grossPay: inputData.grossPay,
      rules: inputData.rules,
      filingStatus: inputData.filingStatus,
    });

    if (calculation.netPay < 0) {
      throw new Error('Calculation error: Withholding deductions exceed gross pay.');
    }

    return { 
      employeeId: inputData.employeeId, 
      jurisdiction: inputData.jurisdiction, 
      calculation 
    };
  },
  retryConfig: {
    attempts: 2,
    delay: 1500,
  },
});

// Assemble the Mastra Workflow
export const taxWithholdingWorkflow = new Workflow({
  name: 'tax-withholding-calculation-orchestration',
  steps: [fetchJurisdictionRulesStep, calculateWithholdingStep],
});

taxWithholdingWorkflow
  .then(fetchJurisdictionRulesStep)
  .then(calculateWithholdingStep);