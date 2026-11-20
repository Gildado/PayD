// src/workflows/taxRuleWorkflow.ts
import { Workflow, Step } from '@mastra/core';
import { taxService } from '../services/taxService';
import { Logger } from '@nestjs/common';

const logger = new Logger('TaxRuleWorkflow');

// Step 1: Validate incoming tax rule parameters
const validateTaxRuleStep = new Step({
  id: 'validateTaxRule',
  execute: async ({ inputData }) => {
    logger.log(`Validating tax rule update for jurisdiction: ${inputData.jurisdiction}`);
    if (!inputData.jurisdiction || !inputData.taxRules) {
      throw new Error('Invalid tax rule payload: jurisdiction and taxRules are required.');
    }
    return { ...inputData, validatedAt: new Date().toISOString() };
  },
});

// Step 2: Simulate tax rule impact against active payroll runs
const simulatePayrollImpactStep = new Step({
  id: 'simulatePayrollImpact',
  execute: async ({ inputData }) => {
    logger.log(`Simulating tax rule changes against active payroll runs for ${inputData.jurisdiction}`);
    const simulationResult = await taxService.simulatePayrollRuns({
      jurisdiction: inputData.jurisdiction,
      newRules: inputData.taxRules,
    });

    if (simulationResult.hasDiscrepancies && !inputData.forceOverride) {
      throw new Error(`Simulation failed: Tax rule changes introduce unhandled payroll discrepancies.`);
    }

    return { ...inputData, simulationResult };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000, // Retry transient failures up to 3 times
  },
});

// Step 3: Apply tax rule update
const applyTaxRuleStep = new Step({
  id: 'applyTaxRule',
  execute: async ({ inputData }) => {
    logger.log(`Applying tax rule update for jurisdiction: ${inputData.jurisdiction}`);
    const updateResult = await taxService.updateJurisdictionRules({
      jurisdiction: inputData.jurisdiction,
      taxRules: inputData.taxRules,
    });
    return { success: true, jurisdiction: inputData.jurisdiction, updateResult };
  },
  retryConfig: {
    attempts: 2,
    delay: 2000,
  },
});

// Assemble the Mastra Workflow
export const taxRuleWorkflow = new Workflow({
  name: 'jurisdiction-tax-rule-update',
  steps: [validateTaxRuleStep, simulatePayrollImpactStep, applyTaxRuleStep],
});

taxRuleWorkflow
  .then(validateTaxRuleStep)
  .then(simulatePayrollImpactStep)
  .then(applyTaxRuleStep);