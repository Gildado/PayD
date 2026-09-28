import { Router } from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import { ExportController } from '../controllers/exportController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { exportJobService } from '../services/exportJobService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Exports
 *   description: Export receipts and payroll reports
 */

/**
 * @swagger
 * /api/v1/exports/receipt/{txHash}/pdf:
 *   get:
 *     summary: Export transaction receipt as PDF
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 */
router.get('/receipt/:txHash/pdf', ExportController.getReceiptPdf);

/**
 * @swagger
 * /api/v1/exports/payroll/{organizationPublicKey}/{batchId}/excel:
 *   get:
 *     summary: Export payroll report as Excel
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: organizationPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excel file
 */
router.get('/payroll/:organizationPublicKey/:batchId/excel', ExportController.getPayrollExcel);

/**
 * @swagger
 * /api/v1/exports/payroll/{organizationPublicKey}/{batchId}/csv:
 *   get:
 *     summary: Export payroll report as CSV
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: organizationPublicKey
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 */
router.get('/payroll/:organizationPublicKey/:batchId/csv', ExportController.getPayrollCsv);

/**
 * @swagger
 * /api/v1/exports/payroll/custom:
 *   post:
 *     summary: Export custom payroll report
 *     tags: [Exports]
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: File download
 */
router.post('/payroll/custom', authenticateJWT, ExportController.getCustomPayrollExport);

/**
 * @swagger
 * /api/v1/exports/payroll/stream-csv:
 *   post:
 *     summary: Stream large CSV export with progress
 *     tags: [Exports]
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: CSV file stream
 *       202:
 *         description: Export queued for async processing
 */
router.post('/payroll/stream-csv', authenticateJWT, ExportController.streamPayrollCsv);

/**
 * @swagger
 * /api/v1/exports/payroll-jobs/{jobId}:
 *   get:
 *     summary: Check async export job status
 *     tags: [Exports]
 */
router.get('/payroll-jobs/:jobId', authenticateJWT, ExportController.getPayrollExportJobStatus);

/**
 * @swagger
 * /api/v1/exports/payroll-jobs/{jobId}/download:
 *   get:
 *     summary: Download completed async export
 *     tags: [Exports]
 */
router.get(
  '/payroll-jobs/:jobId/download',
  authenticateJWT,
  ExportController.downloadPayrollExportJob
);

router.post('/payroll-jobs/excel', authenticateJWT, ExportController.startPayrollExcelJob);

router.post('/download-token', authenticateJWT, ExportController.issueDownloadToken);

/**
 * GET /api/v1/exports/csv-jobs/:jobId
 * Check async CSV export job status.
 */
router.get('/csv-jobs/:jobId', authenticateJWT, async (req, res) => {
  const jobId = String(req.params.jobId);
  const job = exportJobService.getJob(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (job.status === 'failed') {
    res.json({ status: job.status, error: job.error });
    return;
  }
  res.json({ status: job.status });
});

/**
 * GET /api/v1/exports/csv-jobs/:jobId/download
 * Download completed async CSV export.
 */
router.get('/csv-jobs/:jobId/download', authenticateJWT, async (req, res) => {
  const jobId = String(req.params.jobId);
  const job = exportJobService.getJob(jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (job.status !== 'completed') {
    res.status(409).json({ error: 'Export not ready', status: job.status });
    return;
  }

  const filePath = await exportJobService.takeCompletedFile(jobId);
  if (!filePath) {
    res.status(404).json({ error: 'Export file no longer available' });
    return;
  }

  res.setHeader('Content-Type', job.contentType || 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${job.filename || `payroll-export-${jobId}.csv`}"`
  );

  const stream = createReadStream(filePath);
  stream.on('error', (err: Error) => {
    logger.error('csv export job download stream error', err);
    if (!res.headersSent) res.status(500).end();
  });
  res.on('finish', () => {
    void fs.unlink(filePath).catch(() => {});
  });
  stream.pipe(res);
});

export default router;
