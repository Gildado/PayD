// src/workflows/payrollImportWorkflow.ts
import { Workflow, Step } from '@mastra/core'; // Adjust based on installed Mastra SDK version
import { CsvPayrollImportService } from '../services/csvPayrollImportService';
import { Logger } from '@nestjs/common';

const logger = new Logger('PayrollImportWorkflow');

// 1. Stage CSV Step
const stageCsvStep = new Step({
  id: 'stage-csv',
  execute: async ({ context }) => {
    logger.log('Staging CSV payroll import file...');
    const { filePath, tenantId } = context.triggerData;
    
    // Simulate or perform staging / parsing check
    if (!filePath) {
      throw new Error('Staging failed: File path is missing.');
    }

    return { stagedPath: filePath, tenantId, stagedAt: new Date().toISOString() };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000, // 1s backoff
  },
});

// 2. Per-Row Validation Step
const validatePayrollRowsStep = new Step({
  id: 'validate-payroll-rows',
  execute: async ({ context }) => {
    logger.log('Validating payroll rows and collecting per-row issues...');
    const { stagedPath, tenantId } = context.steps['stage-csv'].output;

    const importService = new CsvPayrollImportService();
    const validationResult = await importService.validateCsvRows(stagedPath);

    if (validationResult.hasCriticalErrors) {
      throw new Error(`Validation failed with ${validationResult.errors.length} critical errors.`);
    }

    return {
      validRows: validationResult.validRows,
      errors: validationResult.errors,
      summary: validationResult.summary,
      tenantId,
    };
  },
  retryConfig: {
    attempts: 2,
    delay: 500,
  },
});

// 3. Commit & Report Step
const commitPayrollImportStep = new Step({
  id: 'commit-payroll-import',
  execute: async ({ context }) => {
    logger.log('Committing validated payroll rows and generating report...');
    const validationData = context.steps['validate-payroll-rows'].output;

    const importService = new CsvPayrollImportService();
    const commitResult = await importService.commitValidatedRows(validationData.validRows, validationData.tenantId);

    logger.log(`Payroll import successfully committed. Processed: ${commitResult.processedCount}`);
    return {
      success: true,
      processedCount: commitResult.processedCount,
      errors: validationData.errors,
    };
  },
});

// Assemble the Workflow
export const payrollImportWorkflow = new Workflow({
  name: 'payroll-import-validation-workflow',
  triggerSchema: {
    filePath: 'string',
    tenantId: 'string',
  },
});

payrollImportWorkflow
  .step(stageCsvStep)
  .then(validatePayrollRowsStep)
  .then(commitPayrollImportStep);