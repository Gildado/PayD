import { Workflow, Step } from '@mastra/core';
import { exportJobService } from '../services/exportJobService';
import { Logger } from '@nestjs/common';

const logger = new Logger('ScheduledExportWorkflow');

// Step 1: Generate scheduled export data and file package
const generateExportStep = new Step({
  id: 'generateExport',
  execute: async ({ inputData }) => {
    logger.log(`Generating scheduled export for job: ${inputData.jobId}, format: ${inputData.format || 'CSV'}`);
    const exportResult = await exportJobService.generateExport({
      jobId: inputData.jobId,
      reportType: inputData.reportType,
      parameters: inputData.parameters,
    });

    if (!exportResult || !exportResult.fileUrl) {
      throw new Error(`Export generation failed: File package could not be created for job ${inputData.jobId}`);
    }

    return { ...inputData, fileUrl: exportResult.fileUrl, recordCount: exportResult.recordCount };
  },
  retryConfig: {
    attempts: 3,
    delay: 1500,
  },
});

// Step 2: Deliver export and verify confirmation receipt
const deliverExportStep = new Step({
  id: 'deliverExport',
  execute: async ({ inputData }) => {
    logger.log(`Delivering export file for job: ${inputData.jobId} to recipients.`);
    const deliveryResult = await exportJobService.dispatchExport({
      jobId: inputData.jobId,
      fileUrl: inputData.fileUrl,
      recipients: inputData.recipients,
    });

    if (!deliveryResult || !deliveryResult.confirmed) {
      throw new Error(`Export delivery confirmation failed for job ${inputData.jobId}`);
    }

    return { success: true, jobId: inputData.jobId, deliveryResult };
  },
  retryConfig: {
    attempts: 3,
    delay: 2000,
  },
});

// Assemble the Mastra Workflow
export const scheduledExportWorkflow = new Workflow({
  name: 'scheduled-export-delivery-orchestration',
  steps: [generateExportStep, deliverExportStep],
});

scheduledExportWorkflow
  .then(generateExportStep)
  .then(deliverExportStep);