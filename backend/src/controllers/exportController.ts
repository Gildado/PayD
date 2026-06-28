import { Request, Response } from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import { Pool } from 'pg';
import {
  ExportService,
  type CustomReportColumn,
  type CustomReportRow,
} from '../services/exportService.js';
import { PayrollBonusService } from '../services/payrollBonusService.js';
import { payrollQueryService } from '../services/payroll-query.service.js';
import { type PayrollTransaction } from '../services/payroll-indexing.service.js';
import { exportJobService } from '../services/exportJobService.js';
import { createExportDownloadToken } from '../utils/exportDownloadToken.js';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

async function organizationPublicKeyForUser(organizationId: number | null): Promise<string | null> {
  if (organizationId == null) return null;
  const r = await pool.query('SELECT public_key FROM organizations WHERE id = $1', [
    organizationId,
  ]);
  return r.rows[0]?.public_key ?? null;
}

type PayrollExportFormat = 'csv' | 'excel' | 'pdf';
type PayrollExportColumnId =
  | 'txHash'
  | 'employeeId'
  | 'payrollBatchId'
  | 'itemType'
  | 'amount'
  | 'assetCode'
  | 'assetIssuer'
  | 'status'
  | 'timestamp'
  | 'memo'
  | 'sourceAccount'
  | 'destAccount'
  | 'ledgerHeight'
  | 'fee'
  | 'description';

const CUSTOM_PAYROLL_COLUMNS: Record<PayrollExportColumnId, CustomReportColumn> = {
  txHash: { key: 'txHash', label: 'Transaction Hash', width: 40 },
  employeeId: { key: 'employeeId', label: 'Employee ID', width: 16 },
  payrollBatchId: { key: 'payrollBatchId', label: 'Batch ID', width: 18 },
  itemType: { key: 'itemType', label: 'Payment Type', width: 14 },
  amount: { key: 'amount', label: 'Amount', width: 14 },
  assetCode: { key: 'assetCode', label: 'Asset', width: 12 },
  assetIssuer: { key: 'assetIssuer', label: 'Asset Issuer', width: 38 },
  status: { key: 'status', label: 'Status', width: 12 },
  timestamp: { key: 'timestamp', label: 'Timestamp', width: 22 },
  memo: { key: 'memo', label: 'Memo', width: 42 },
  sourceAccount: { key: 'sourceAccount', label: 'Source Account', width: 38 },
  destAccount: { key: 'destAccount', label: 'Destination Account', width: 38 },
  ledgerHeight: { key: 'ledgerHeight', label: 'Ledger', width: 12 },
  fee: { key: 'fee', label: 'Fee', width: 12 },
  description: { key: 'description', label: 'Description', width: 36 },
};

function isPayrollExportFormat(value: unknown): value is PayrollExportFormat {
  return value === 'csv' || value === 'excel' || value === 'pdf';
}

function isPayrollExportColumnId(value: unknown): value is PayrollExportColumnId {
  return typeof value === 'string' && value in CUSTOM_PAYROLL_COLUMNS;
}

function normalizePayrollExportRow(transaction: PayrollTransaction): CustomReportRow {
  return {
    txHash: transaction.txHash,
    employeeId: transaction.employeeId || 'N/A',
    payrollBatchId: transaction.payrollBatchId || 'N/A',
    itemType: transaction.itemType === 'bonus' ? 'Bonus' : 'Base Salary',
    amount: transaction.amount || '0',
    assetCode: transaction.assetCode || 'Native',
    assetIssuer: transaction.assetIssuer || '',
    status: transaction.successful ? 'Success' : 'Failed',
    timestamp: new Date(transaction.timestamp * 1000).toISOString(),
    memo: transaction.memo || '',
    sourceAccount: transaction.sourceAccount || '',
    destAccount: transaction.destAccount || '',
    ledgerHeight: transaction.ledgerHeight,
    fee: transaction.fee || '0',
    description: transaction.description || '',
  };
}

async function fetchAllPayrollTransactions(
  organizationPublicKey: string,
  startDate?: Date,
  endDate?: Date
): Promise<PayrollTransaction[]> {
  const rows: PayrollTransaction[] = [];
  let page = 1;
  const limit = 500;

  while (page <= 100) {
    const result = await payrollQueryService.queryPayroll(
      {
        organizationPublicKey,
        startDate,
        endDate,
        includeFailedPayments: true,
      },
      page,
      limit,
      {
        enrichPayrollData: true,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      }
    );

    rows.push(...result.data);
    if (!result.hasMore || result.data.length === 0) {
      break;
    }

    page += 1;
  }

  return rows;
}

export class ExportController {
  /**
   * Generates and streams a PDF receipt for a specific transaction.
   */
  static async getReceiptPdf(req: Request, res: Response): Promise<void> {
    try {
      const { txHash } = req.params;

      const transaction = await payrollQueryService.getTransactionDetails(txHash as string);
      if (!transaction) {
        res.status(404).json({ success: false, error: 'Transaction not found' });
        return;
      }

      // Fetch item_type and description from database if available
      const payrollItem = await PayrollBonusService.getPayrollItemByTxHash(txHash as string);

      // Enrich transaction with item type and description
      const enrichedTransaction = {
        ...transaction,
        itemType: payrollItem?.item_type,
        description: payrollItem?.description,
      };

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="receipt-${(txHash as string).substring(0, 8)}.pdf"`
      );

      await ExportService.generateReceiptPdf(enrichedTransaction, res);
    } catch (error) {
      logger.error('Failed to generate PDF receipt', { error });

      // If headers are already sent, we can't send a JSON response.
      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: 'Internal server error during PDF generation' });
      } else {
        res.end();
      }
    }
  }

  /**
   * Generates and streams an Excel report for a payroll batch.
   */
  static async getPayrollExcel(req: Request, res: Response): Promise<void> {
    try {
      const { organizationPublicKey, batchId } = req.params;

      // We would likely fetch all or a large chunk of transactions for the batch.
      // Assuming getPayrollBatch returns a paginated result, we might need a way to fetch all,
      // but for this implementation, we'll fetch the first massive page or assume limit handles it.
      const batchData = await payrollQueryService.getPayrollBatch(
        organizationPublicKey as string,
        batchId as string,
        1,
        500_000
      );

      if (!batchData || batchData.data.length === 0) {
        res.status(404).json({ success: false, error: 'Batch not found or empty' });
        return;
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="payroll-batch-${batchId}.xlsx"`);

      await ExportService.generatePayrollExcel(batchId as string, batchData.data, res);
    } catch (error) {
      logger.error('Failed to generate Excel report', { error });

      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: 'Internal server error during Excel generation' });
      } else {
        res.end();
      }
    }
  }

  /**
   * Generates and streams a CSV report for a payroll batch.
   */
  static async getPayrollCsv(req: Request, res: Response): Promise<void> {
    try {
      const { organizationPublicKey, batchId } = req.params;

      const batchData = await payrollQueryService.getPayrollBatch(
        organizationPublicKey as string,
        batchId as string,
        1,
        500_000
      );

      if (!batchData || batchData.data.length === 0) {
        res.status(404).json({ success: false, error: 'Batch not found or empty' });
        return;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-batch-${batchId}.csv"`);

      await ExportService.generatePayrollCsv(batchData.data, res);
    } catch (error) {
      logger.error('Failed to generate CSV report', { error });

      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: 'Internal server error during CSV generation' });
      } else {
        res.end();
      }
    }
  }

  /**
   * Generates a custom payroll export with caller-selected columns and format.
   */
  static async getCustomPayrollExport(req: Request, res: Response): Promise<void> {
    try {
      const { organizationPublicKey, startDate, endDate, format, columns } = req.body ?? {};

      if (!organizationPublicKey) {
        res.status(400).json({ success: false, error: 'organizationPublicKey is required' });
        return;
      }

      if (!isPayrollExportFormat(format)) {
        res.status(400).json({ success: false, error: 'format must be csv, excel, or pdf' });
        return;
      }

      if (!Array.isArray(columns) || columns.length === 0) {
        res.status(400).json({ success: false, error: 'At least one column must be selected' });
        return;
      }

      const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);
      if (organizationPublicKey !== orgPk) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const selectedColumns = columns.filter(isPayrollExportColumnId);
      if (selectedColumns.length === 0) {
        res.status(400).json({ success: false, error: 'No valid columns were supplied' });
        return;
      }

      const transactions = await fetchAllPayrollTransactions(
        organizationPublicKey as string,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      if (transactions.length === 0) {
        res
          .status(404)
          .json({ success: false, error: 'No payroll data found for the selected range' });
        return;
      }

      const rows = transactions.map(normalizePayrollExportRow);
      const exportColumns = selectedColumns.map((columnId) => CUSTOM_PAYROLL_COLUMNS[columnId]);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `payroll-custom-${timestamp}`;

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        await ExportService.generateCustomCsv(exportColumns, rows, res);
        return;
      }

      if (format === 'excel') {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        await ExportService.generateCustomExcel('Payroll Export', exportColumns, rows, res);
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      await ExportService.generateCustomPdf('Custom Payroll Export', exportColumns, rows, res);
    } catch (error) {
      logger.error('Failed to generate custom payroll export', { error });
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to generate custom export' });
      } else {
        res.end();
      }
    }
  }

  /**
   * POST /api/v1/exports/download-token
   * Issues a time-limited HMAC token for PDF or payroll downloads (shareable signed URL).
   */
  static async issueDownloadToken(req: Request, res: Response): Promise<void> {
    try {
      const ttlRaw = Number(req.body?.ttlSec);
      const ttlSec = Math.min(Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : 900, 3600);
      const exp = Math.floor(Date.now() / 1000) + ttlSec;
      const kind = req.body?.kind as string | undefined;

      const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);

      if (kind === 'receipt') {
        const txHash = req.body?.txHash as string | undefined;
        if (!txHash) {
          res.status(400).json({ error: 'txHash is required for receipt tokens' });
          return;
        }
        const tx = await payrollQueryService.getTransactionDetails(txHash);
        if (!tx || tx.sourceAccount !== orgPk) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        const token = createExportDownloadToken({ kind: 'receipt', txHash, exp });
        const q = `token=${encodeURIComponent(token)}`;
        res.json({
          expiresAt: new Date(exp * 1000).toISOString(),
          pdfUrl: `/api/v1/exports/receipt/${encodeURIComponent(txHash)}/pdf?${q}`,
          token,
        });
        return;
      }

      if (kind === 'payroll') {
        const organizationPublicKey = req.body?.organizationPublicKey as string | undefined;
        const batchId = req.body?.batchId as string | undefined;
        if (!organizationPublicKey || !batchId) {
          res.status(400).json({ error: 'organizationPublicKey and batchId are required' });
          return;
        }
        if (organizationPublicKey !== orgPk) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        const token = createExportDownloadToken({
          kind: 'payroll',
          organizationPublicKey,
          batchId,
          exp,
        });
        const q = `token=${encodeURIComponent(token)}`;
        res.json({
          expiresAt: new Date(exp * 1000).toISOString(),
          excelUrl: `/api/v1/exports/payroll/${encodeURIComponent(organizationPublicKey)}/${encodeURIComponent(batchId)}/excel?${q}`,
          csvUrl: `/api/v1/exports/payroll/${encodeURIComponent(organizationPublicKey)}/${encodeURIComponent(batchId)}/csv?${q}`,
          token,
        });
        return;
      }

      res.status(400).json({ error: 'kind must be receipt or payroll' });
    } catch (error) {
      logger.error('issueDownloadToken failed', { error });
      res.status(500).json({ error: 'Failed to issue download token' });
    }
  }

  /** POST /api/v1/exports/payroll-jobs/excel — async generation for large batches */
  static async startPayrollExcelJob(req: Request, res: Response): Promise<void> {
    try {
      const organizationPublicKey = req.body?.organizationPublicKey as string | undefined;
      const batchId = req.body?.batchId as string | undefined;
      if (!organizationPublicKey || !batchId) {
        res.status(400).json({ error: 'organizationPublicKey and batchId are required' });
        return;
      }
      const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);
      if (organizationPublicKey !== orgPk) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const jobId = exportJobService.startPayrollExcelJob(organizationPublicKey, batchId);
      res.status(202).json({
        jobId,
        statusUrl: `/api/v1/exports/payroll-jobs/${jobId}`,
        downloadUrl: `/api/v1/exports/payroll-jobs/${jobId}/download`,
      });
    } catch (error) {
      logger.error('startPayrollExcelJob failed', { error });
      res.status(500).json({ error: 'Failed to start export job' });
    }
  }

  static async getPayrollExportJobStatus(req: Request, res: Response): Promise<void> {
    const jobId = String(req.params.jobId);
    const job = exportJobService.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);
    if (job.organizationPublicKey !== orgPk) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (job.status === 'failed') {
      res.json({ status: job.status, error: job.error });
      return;
    }
    res.json({ status: job.status });
  }

  static async downloadPayrollExportJob(req: Request, res: Response): Promise<void> {
    const jobId = String(req.params.jobId);
    const jobBefore = exportJobService.getJob(jobId);
    if (!jobBefore) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const orgPk = await organizationPublicKeyForUser(req.user?.organizationId ?? null);
    if (jobBefore.organizationPublicKey !== orgPk) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (jobBefore.status !== 'completed') {
      res.status(409).json({ error: 'Export not ready', status: jobBefore.status });
      return;
    }

    const filePath = await exportJobService.takeCompletedFile(jobId);
    if (!filePath) {
      res.status(404).json({ error: 'Export file no longer available' });
      return;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payroll-batch-${jobBefore.batchId}.xlsx"`
    );

    const stream = createReadStream(filePath);
    stream.on('error', (err) => {
      logger.error('export job download stream error', err);
      if (!res.headersSent) res.status(500).end();
    });
    res.on('finish', () => {
      void fs.unlink(filePath).catch(() => {});
    });
    stream.pipe(res);
  }
}
