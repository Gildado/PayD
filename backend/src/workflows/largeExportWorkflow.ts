// src/workflows/largeExportWorkflow.ts
import { Workflow, Step } from '@mastra/core';
import { ExportJobService } from '../services/exportJobService';
import { Logger } from '@nestjs/common';

const logger = new Logger('LargeExportWorkflow');

// 1. Initialize and Chunk Export Job Step
const initAndChunkExportStep = new Step({
  id: 'init-and-chunk-export',
  execute: async ({ context }) => {
    logger.log('Initializing large data export job and splitting into chunks...');
    const { jobId, queryParams, tenantId } = context.triggerData;

    const exportService = new ExportJobService();
    const chunkMetadata = await exportService.initializeChunks(jobId, queryParams);

    if (!chunkMetadata || chunkMetadata.totalChunks === 0) {
      throw new Error('Export initialization failed: No records found or invalid query parameters.');
    }

    logger.log(`Export initialized. Total chunks to process: ${chunkMetadata.totalChunks}`);
    return { jobId, chunks: chunkMetadata.chunks, tenantId };
  },
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
});

// 2. Process Export Chunks Step with Progress Tracking
const processChunksStep = new Step({
  id: 'process-export-chunks',
  execute: async ({ context }) => {
    logger.log('Processing export chunks with progress tracking...');
    const { jobId, chunks } = context.steps['init-and-chunk-export'].output;
    const exportService = new ExportJobService();

    const processedResults = [];
    for (const [index, chunk] of chunks.entries()) {
      try {
        logger.log(`Processing chunk ${index + 1} of ${chunks.length} (ID: ${chunk.id})`);
        const result = await exportService.processChunk(jobId, chunk);
        processedResults.push(result);
      } catch (error) {
        logger.error(`Error processing chunk ${chunk.id}: ${error.message}. Retrying...`);
        // Retry individual chunk processing
        const retryResult = await exportService.processChunk(jobId, chunk);
        processedResults.push(retryResult);
      }
    }

    return { jobId, processedChunksCount: processedResults.length };
  },
  retryConfig: {
    attempts: 2,
    delay: 2000,
  },
});

// 3. Assemble and Notify Step
const assembleAndNotifyStep = new Step({
  id: 'assemble-and-notify',
  execute: async ({ context }) => {
    logger.log('Assembling final export file and triggering notification...');
    const { jobId, processedChunksCount } = context.steps['process-export-chunks'].output;
    const { tenantId } = context.steps['init-and-chunk-export'].output;

    const exportService = new ExportJobService();
    const finalExport = await exportService.assembleAndFinalize(jobId);

    logger.log(`Export job ${jobId} successfully assembled. File URL: ${finalExport.fileUrl}`);
    return {
      success: true,
      jobId,
      processedChunksCount,
      fileUrl: finalExport.fileUrl,
      tenantId,
    };
  },
});

// Assemble the Workflow
export const largeExportWorkflow = new Workflow({
  name: 'large-export-job-orchestration-workflow',
  triggerSchema: {
    jobId: 'string',
    queryParams: 'object',
    tenantId: 'string',
  },
});

largeExportWorkflow
  .step(initAndChunkExportStep)
  .then(processChunksStep)
  .then(assembleAndNotifyStep);