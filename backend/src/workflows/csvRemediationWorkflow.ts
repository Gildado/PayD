// src/workflows/csvRemediationWorkflow.ts
import { Workflow, Step, Agent } from '@mastra/core';
import { CsvPayrollImportService } from '../services/csvPayrollImportService';
import { Logger } from '@nestjs/common';

const logger = new Logger('CsvRemediationWorkflow');

// Define the Mastra Remediation Agent
const csvRemediationAgent = new Agent({
  name: 'csv-error-remediation-agent',
  instructions: `You are an expert AI payroll data assistant for PayD. Your task is to analyze failed CSV payroll import rows and their raw error messages (e.g., currency mismatch, missing wallet address, invalid format), then generate clear, concise, and actionable remediation suggestions for the user to fix their CSV file before re-importing.`,
  model: {
    provider: 'openai',
    name: 'gpt-4o',
  },
});

// 1. Parse and Extract Failed Rows Step
const extractFailedRowsStep = new Step({
  id: 'extract-failed-rows',
  execute: async ({ context }) => {
    logger.log('Extracting failed validation rows from CSV payroll import service...');
    const { filePath, tenantId } = context.triggerData;

    const importService = new CsvPayrollImportService();
    const validationResult = await importService.validateCsvRows(filePath);

    if (!validationResult.errors || validationResult.errors.length === 0) {
      return { hasFailures: false, failedRows: [], tenantId };
    }

    return {
      hasFailures: true,
      failedRows: validationResult.errors,
      tenantId,
    };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
});

// 2. AI Remediation Analysis Step
const generateRemediationsStep = new Step({
  id: 'generate-remediations',
  execute: async ({ context }) => {
    const extractionOutput = context.steps['extract-failed-rows'].output;

    if (!extractionOutput.hasFailures) {
      logger.log('No failed rows found. Remediation workflow skipped.');
      return { remediations: [], status: 'NO_FAILURES' };
    }

    logger.log(`Analyzing ${extractionOutput.failedRows.length} failed rows with AI remediation agent...`);
    
    const remediationResults = [];
    for (const rowError of extractionOutput.failedRows) {
      const prompt = `Analyze this CSV payroll import error and provide a precise remediation suggestion:
      - Row Number: ${rowError.rowIndex}
      - Row Data: ${JSON.stringify(rowError.data)}
      - Raw Error: ${rowError.message}`;

      const response = await csvRemediationAgent.generate(prompt);
      remediationResults.push({
        rowIndex: rowError.rowIndex,
        rawError: rowError.message,
        suggestion: response.text,
      });
    }

    logger.log('Successfully generated remediation suggestions for all failed rows.');
    return {
      status: 'REMEDIATIONS_GENERATED',
      remediations: remediationResults,
    };
  },
  retryConfig: {
    attempts: 2,
    delay: 2000,
  },
});

// Assemble the Workflow
export const csvRemediationWorkflow = new Workflow({
  name: 'csv-import-error-remediation-workflow',
  triggerSchema: {
    filePath: 'string',
    tenantId: 'string',
  },
});

csvRemediationWorkflow
  .step(extractFailedRowsStep)
  .then(generateRemediationsStep);