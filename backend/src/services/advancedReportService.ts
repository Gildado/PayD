import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import * as csv from 'fast-csv';
import { pipeline } from 'stream/promises';
import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  existsSync,
  unlinkSync,
  statSync,
} from 'fs';
import { Writable } from 'stream';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import {
  PayrollAuditLog,
  AuditLogWithDetails,
  PayrollAuditService,
} from './payrollAuditService.js';
import { payrollQueryService } from './payroll-query.service.js';
import { pool } from '../config/database.js';
import { CacheService } from './cacheService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ReportFilter {
  organizationId: number;
  startDate?: Date;
  endDate?: Date;
  payrollRunId?: number;
  employeeId?: number;
  assetCode?: string;
}

export interface PayrollHistoryReport {
  organizationId: number;
  organizationName: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  summary: {
    totalTransactions: number;
    totalAmount: string;
    successfulTransactions: number;
    failedTransactions: number;
    uniqueEmployees: number;
    assetsInvolved: string[];
  };
  transactions: TransactionReportItem[];
}

export interface TransactionReportItem {
  txHash: string;
  employeeId: number | null;
  employeeName: string;
  employeeEmail: string;
  amount: string;
  assetCode: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
  batchId: string | null;
  memo: string | null;
}

export interface AuditLogReport {
  organizationId: number;
  organizationName: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  summary: {
    totalActions: number;
    byAction: Record<string, number>;
    byActorType: Record<string, number>;
    successfulTransactions: number;
    failedTransactions: number;
  };
  auditLogs: AuditLogWithDetails[];
}

export interface ReportStorageConfig {
  storagePath: string;
  maxAgeMs: number;
  maxFileSizeBytes: number;
}

export interface ReportVersion {
  id: string;
  reportId: string;
  version: number;
  generatedAt: Date;
  filters: ReportFilter;
  format: 'pdf' | 'excel' | 'csv';
  filePath: string;
  size: number;
  checksum: string;
}

export interface PiiRedactionConfig {
  redactEmails?: boolean;
  redactPhoneNumbers?: boolean;
  redactEmployeeIds?: boolean;
  redactNames?: boolean;
  redactMemos?: boolean;
  maskPattern?: string;
}

export interface CachedReport {
  key: string;
  data: unknown;
  format: string;
  timestamp: number;
}

const DEFAULT_PII_REDACTION: PiiRedactionConfig = {
  redactEmails: true,
  redactPhoneNumbers: true,
  redactEmployeeIds: false,
  redactNames: false,
  redactMemos: false,
  maskPattern: '****',
};

const DEFAULT_STORAGE_CONFIG: ReportStorageConfig = {
  storagePath: join(__dirname, '../../reports'),
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  maxFileSizeBytes: 50 * 1024 * 1024,
};

export class AdvancedReportService {
  private storageConfig: ReportStorageConfig;
  private cache: CacheService;
  private piiRedactionConfig: PiiRedactionConfig;
  private reportVersions: Map<string, ReportVersion[]> = new Map();

  constructor(
    storageConfig: ReportStorageConfig = DEFAULT_STORAGE_CONFIG,
    piiRedactionConfig: PiiRedactionConfig = DEFAULT_PII_REDACTION
  ) {
    this.storageConfig = storageConfig;
    this.piiRedactionConfig = piiRedactionConfig;
    this.cache = new CacheService({ ttlSeconds: 60 * 60, keyPrefix: 'reports' });
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    if (!existsSync(this.storageConfig.storagePath)) {
      mkdirSync(this.storageConfig.storagePath, { recursive: true });
    }
  }

  async generatePayrollHistoryPdf(
    filter: ReportFilter,
    stream: NodeJS.WritableStream
  ): Promise<void> {
    const report = await this.buildPayrollHistoryReport(filter);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: `Payroll History Report - ${report.organizationName}`,
            Author: 'PayD Report Engine',
            Subject: 'Payroll History',
            CreationDate: report.generatedAt,
          },
        });

        doc.pipe(stream);

        stream.on('finish', () => resolve());
        stream.on('error', reject);
        doc.on('error', reject);

        this.renderPdfHeader(doc, report);
        this.renderPdfSummary(doc, report);
        this.renderPdfTransactions(doc, report);
        this.renderPdfFooter(doc, report);

        doc.end();
      } catch (error) {
        logger.error('PDF generation failed', { error, filter });
        reject(error);
      }
    });
  }

  async generatePayrollHistoryExcel(
    filter: ReportFilter,
    stream: NodeJS.WritableStream
  ): Promise<void> {
    const report = await this.buildPayrollHistoryReport(filter);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PayD Report Engine';
    workbook.created = report.generatedAt;
    workbook.lastModifiedBy = 'PayD Advanced Reporting';

    await this.addExcelSummarySheet(workbook, report);
    await this.addExcelTransactionsSheet(workbook, report);
    await this.addExcelAssetsBreakdownSheet(workbook, report);

    await workbook.xlsx.write(stream as any);
  }

  async generateAuditLogPdf(filter: ReportFilter, stream: NodeJS.WritableStream): Promise<void> {
    const report = await this.buildAuditLogReport(filter);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: `Audit Log Report - ${report.organizationName}`,
            Author: 'PayD Report Engine',
            Subject: 'Audit Logs',
            CreationDate: report.generatedAt,
          },
        });

        doc.pipe(stream);

        stream.on('finish', () => resolve());
        stream.on('error', reject);
        doc.on('error', reject);

        this.renderAuditPdfHeader(doc, report);
        this.renderAuditPdfSummary(doc, report);
        this.renderAuditPdfLogs(doc, report);
        this.renderPdfFooter(doc, report);

        doc.end();
      } catch (error) {
        logger.error('Audit PDF generation failed', { error, filter });
        reject(error);
      }
    });
  }

  async generateAuditLogExcel(filter: ReportFilter, stream: NodeJS.WritableStream): Promise<void> {
    const report = await this.buildAuditLogReport(filter);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PayD Report Engine';
    workbook.created = report.generatedAt;

    await this.addAuditExcelSummarySheet(workbook, report);
    await this.addAuditExcelLogsSheet(workbook, report);
    await this.addAuditExcelByActionSheet(workbook, report);

    await workbook.xlsx.write(stream as any);
  }

  private async buildPayrollHistoryReport(filter: ReportFilter): Promise<PayrollHistoryReport> {
    const orgResult = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [
      filter.organizationId,
    ]);
    const organization = orgResult.rows[0] || {
      id: filter.organizationId,
      name: 'Unknown Organization',
    };

    const conditions: string[] = ['pr.organization_id = $1'];
    const values: (number | string | Date)[] = [filter.organizationId];
    let paramIdx = 2;

    if (filter.startDate) {
      conditions.push(`pi.created_at >= $${paramIdx++}`);
      values.push(filter.startDate);
    }

    if (filter.endDate) {
      conditions.push(`pi.created_at <= $${paramIdx++}`);
      values.push(filter.endDate);
    }

    if (filter.payrollRunId) {
      conditions.push(`pi.payroll_run_id = $${paramIdx++}`);
      values.push(filter.payrollRunId);
    }

    if (filter.employeeId) {
      conditions.push(`pi.employee_id = $${paramIdx++}`);
      values.push(filter.employeeId);
    }

    if (filter.assetCode) {
      conditions.push(`pi.asset_code = $${paramIdx++}`);
      values.push(filter.assetCode);
    }

    const whereClause = conditions.join(' AND ');

    const transactionsResult = await pool.query(
      `SELECT
        pi.tx_hash,
        pi.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        pi.amount,
        pi.asset_code,
        pi.status,
        pi.created_at,
        pr.batch_id,
        pi.memo
      FROM payroll_items pi
      LEFT JOIN employees e ON pi.employee_id = e.id
      LEFT JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
      WHERE ${whereClause}
      ORDER BY pi.created_at DESC
      LIMIT 10000`,
      values
    );

    const transactions: TransactionReportItem[] = transactionsResult.rows.map((row) => ({
      txHash: row.tx_hash || '',
      employeeId: row.employee_id,
      employeeName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown',
      employeeEmail: row.email || '',
      amount: row.amount || '0',
      assetCode: row.asset_code || 'XLM',
      status:
        row.status === 'completed' ? 'success' : row.status === 'failed' ? 'failed' : 'pending',
      timestamp: row.created_at,
      batchId: row.batch_id,
      memo: row.memo,
    }));

    const summary = {
      totalTransactions: transactions.length,
      totalAmount: transactions
        .reduce((sum, tx) => sum + parseFloat(tx.amount || '0'), 0)
        .toFixed(2),
      successfulTransactions: transactions.filter((tx) => tx.status === 'success').length,
      failedTransactions: transactions.filter((tx) => tx.status === 'failed').length,
      uniqueEmployees: new Set(transactions.map((tx) => tx.employeeId).filter(Boolean)).size,
      assetsInvolved: [...new Set(transactions.map((tx) => tx.assetCode))],
    };

    return {
      organizationId: filter.organizationId,
      organizationName: organization.name,
      generatedAt: new Date(),
      dateRange: {
        start: filter.startDate || transactions[transactions.length - 1]?.timestamp || new Date(),
        end: filter.endDate || new Date(),
      },
      summary,
      transactions,
    };
  }

  private async buildAuditLogReport(filter: ReportFilter): Promise<AuditLogReport> {
    const orgResult = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [
      filter.organizationId,
    ]);
    const organization = orgResult.rows[0] || {
      id: filter.organizationId,
      name: 'Unknown Organization',
    };

    const auditFilter = {
      organizationId: filter.organizationId,
      startDate: filter.startDate,
      endDate: filter.endDate,
      payrollRunId: filter.payrollRunId,
      employeeId: filter.employeeId,
    };

    const { data: auditLogs, total } = await PayrollAuditService.getAuditLogs(
      auditFilter,
      1,
      10000
    );

    const summary = await PayrollAuditService.getAuditSummary(
      filter.organizationId,
      filter.startDate,
      filter.endDate
    );

    return {
      organizationId: filter.organizationId,
      organizationName: organization.name,
      generatedAt: new Date(),
      dateRange: {
        start: filter.startDate || auditLogs[auditLogs.length - 1]?.created_at || new Date(),
        end: filter.endDate || new Date(),
      },
      summary: {
        totalActions: total,
        byAction: summary.byAction,
        byActorType: summary.byActorType,
        successfulTransactions: summary.successfulTransactions,
        failedTransactions: summary.failedTransactions,
      },
      auditLogs,
    };
  }

  private renderPdfHeader(doc: PDFDocument, report: PayrollHistoryReport): void {
    doc
      .fillColor('#1a365d')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('Payroll History Report', { align: 'center' })
      .moveDown(0.5);

    doc
      .fillColor('#4a5568')
      .fontSize(12)
      .font('Helvetica')
      .text(report.organizationName, { align: 'center' })
      .moveDown(0.3);

    doc
      .fontSize(10)
      .fillColor('#718096')
      .text(
        `Generated: ${report.generatedAt.toLocaleString()} | Period: ${report.dateRange.start.toLocaleDateString()} - ${report.dateRange.end.toLocaleDateString()}`,
        { align: 'center' }
      )
      .moveDown(1.5);

    doc
      .strokeColor('#e2e8f0')
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .stroke()
      .moveDown(1);
  }

  private renderPdfSummary(doc: PDFDocument, report: PayrollHistoryReport): void {
    doc
      .fillColor('#2d3748')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Summary', { underline: true })
      .moveDown(0.5);

    const summaryData = [
      ['Total Transactions', report.summary.totalTransactions.toString()],
      ['Total Amount', `${report.summary.totalAmount} (across all assets)`],
      ['Successful', report.summary.successfulTransactions.toString()],
      ['Failed', report.summary.failedTransactions.toString()],
      ['Unique Employees', report.summary.uniqueEmployees.toString()],
      ['Assets', report.summary.assetsInvolved.join(', ') || 'None'],
    ];

    const startY = doc.y;
    const col1X = 60;
    const col2X = 250;

    doc.fontSize(10).font('Helvetica');
    summaryData.forEach(([label, value], idx) => {
      const y = startY + idx * 18;
      doc.fillColor('#4a5568').text(label + ':', col1X, y);
      doc.fillColor('#2d3748').font('Helvetica-Bold').text(value, col2X, y);
      doc.font('Helvetica');
    });

    doc.moveDown(3);
  }

  private renderPdfTransactions(doc: PDFDocument, report: PayrollHistoryReport): void {
    doc
      .fillColor('#2d3748')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Transactions', { underline: true })
      .moveDown(0.5);

    const headers = ['Date', 'Employee', 'Amount', 'Asset', 'Status'];
    const colWidths = [80, 150, 80, 60, 60];
    const startX = 40;
    let y = doc.y;

    doc.fillColor('#4a5568').fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, idx) => {
      doc.text(header, startX + colWidths.slice(0, idx).reduce((a, b) => a + b, 0), y);
    });

    y += 5;
    doc
      .strokeColor('#e2e8f0')
      .moveTo(startX, y)
      .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y)
      .stroke();

    y += 10;
    doc.fontSize(8).font('Helvetica');

    const transactionsToRender = report.transactions.slice(0, 100);
    for (const tx of transactionsToRender) {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = doc.y;
      }

      doc.fillColor('#2d3748');
      doc.text(tx.timestamp.toLocaleDateString(), startX, y);
      doc.text(tx.employeeName.substring(0, 20), startX + colWidths[0], y);
      doc.text(tx.amount, startX + colWidths[0] + colWidths[1], y);
      doc.text(tx.assetCode, startX + colWidths[0] + colWidths[1] + colWidths[2], y);

      doc.fillColor(
        tx.status === 'success' ? '#38a169' : tx.status === 'failed' ? '#e53e3e' : '#d69e2e'
      );
      doc.text(
        tx.status.toUpperCase(),
        startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        y
      );

      y += 15;
    }

    if (report.transactions.length > 100) {
      doc
        .moveDown(2)
        .fillColor('#718096')
        .fontSize(9)
        .text(
          `(Showing 100 of ${report.transactions.length} transactions. Export to Excel for full data.)`
        );
    }

    doc.moveDown(2);
  }

  private renderAuditPdfHeader(doc: PDFDocument, report: AuditLogReport): void {
    doc
      .fillColor('#1a365d')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('Audit Log Report', { align: 'center' })
      .moveDown(0.5);

    doc
      .fillColor('#4a5568')
      .fontSize(12)
      .font('Helvetica')
      .text(report.organizationName, { align: 'center' })
      .moveDown(0.3);

    doc
      .fontSize(10)
      .fillColor('#718096')
      .text(
        `Generated: ${report.generatedAt.toLocaleString()} | Period: ${report.dateRange.start.toLocaleDateString()} - ${report.dateRange.end.toLocaleDateString()}`,
        { align: 'center' }
      )
      .moveDown(1.5);

    doc
      .strokeColor('#e2e8f0')
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .stroke()
      .moveDown(1);
  }

  private renderAuditPdfSummary(doc: PDFDocument, report: AuditLogReport): void {
    doc
      .fillColor('#2d3748')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Summary', { underline: true })
      .moveDown(0.5);

    const summaryData = [
      ['Total Actions', report.summary.totalActions.toString()],
      ['Successful Transactions', report.summary.successfulTransactions.toString()],
      ['Failed Transactions', report.summary.failedTransactions.toString()],
    ];

    const startY = doc.y;
    const col1X = 60;
    const col2X = 250;

    doc.fontSize(10).font('Helvetica');
    summaryData.forEach(([label, value], idx) => {
      const y = startY + idx * 18;
      doc.fillColor('#4a5568').text(label + ':', col1X, y);
      doc.fillColor('#2d3748').font('Helvetica-Bold').text(value, col2X, y);
      doc.font('Helvetica');
    });

    doc.moveDown(3);
  }

  private renderAuditPdfLogs(doc: PDFDocument, report: AuditLogReport): void {
    doc
      .fillColor('#2d3748')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Audit Entries', { underline: true })
      .moveDown(0.5);

    const logsToRender = report.auditLogs.slice(0, 50);
    let y = doc.y;

    doc.fontSize(9).font('Helvetica');
    for (const log of logsToRender) {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = doc.y;
      }

      const date =
        log.created_at instanceof Date ? log.created_at.toLocaleString() : String(log.created_at);
      const action = log.action.replace(/_/g, ' ');
      const actor = log.actor_email || log.actor_type;

      doc.fillColor('#4a5568').text(date, 40, y);
      doc.fillColor('#2d3748').font('Helvetica-Bold').text(action, 150, y);
      doc.font('Helvetica').fillColor('#718096').text(actor, 350, y);

      if (log.amount) {
        doc.fillColor('#38a169').text(`${log.amount} ${log.asset_code || ''}`, 450, y);
      }

      y += 18;
    }

    if (report.auditLogs.length > 50) {
      doc
        .moveDown(2)
        .fillColor('#718096')
        .fontSize(9)
        .text(`(Showing 50 of ${report.auditLogs.length} entries. Export to Excel for full data.)`);
    }
  }

  private renderPdfFooter(doc: PDFDocument, report: PayrollHistoryReport | AuditLogReport): void {
    doc
      .moveDown(3)
      .strokeColor('#e2e8f0')
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .stroke()
      .moveDown(0.5);

    doc
      .fillColor('#a0aec0')
      .fontSize(8)
      .text('Generated by PayD Advanced Reporting Engine', { align: 'center' })
      .text(
        'This document is for internal use only and contains confidential payroll information.',
        { align: 'center' }
      );
  }

  private async addExcelSummarySheet(
    workbook: ExcelJS.Workbook,
    report: PayrollHistoryReport
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Summary');

    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 40 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D3748' },
    };

    const summaryRows = [
      { metric: 'Organization', value: report.organizationName },
      { metric: 'Report Generated', value: report.generatedAt.toLocaleString() },
      { metric: 'Period Start', value: report.dateRange.start.toLocaleDateString() },
      { metric: 'Period End', value: report.dateRange.end.toLocaleDateString() },
      { metric: 'Total Transactions', value: report.summary.totalTransactions },
      { metric: 'Total Amount', value: report.summary.totalAmount },
      { metric: 'Successful Transactions', value: report.summary.successfulTransactions },
      { metric: 'Failed Transactions', value: report.summary.failedTransactions },
      { metric: 'Unique Employees', value: report.summary.uniqueEmployees },
      { metric: 'Assets Involved', value: report.summary.assetsInvolved.join(', ') },
    ];

    summaryRows.forEach((row) => sheet.addRow(row));

    sheet.addRow([]);
    sheet.addRow([]);

    sheet.addRow({ metric: 'Transactions by Status', value: '' }).font = { bold: true };
    sheet.addRow({
      metric: 'Success Rate',
      value: `${((report.summary.successfulTransactions / report.summary.totalTransactions) * 100 || 0).toFixed(2)}%`,
    });
    sheet.addRow({
      metric: 'Failure Rate',
      value: `${((report.summary.failedTransactions / report.summary.totalTransactions) * 100 || 0).toFixed(2)}%`,
    });
  }

  private async addExcelTransactionsSheet(
    workbook: ExcelJS.Workbook,
    report: PayrollHistoryReport
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Transactions');

    sheet.columns = [
      { header: 'Transaction Hash', key: 'txHash', width: 60 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Employee Email', key: 'employeeEmail', width: 30 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Asset', key: 'assetCode', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Batch ID', key: 'batchId', width: 25 },
      { header: 'Memo', key: 'memo', width: 30 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D3748' },
    };

    report.transactions.forEach((tx) => {
      const row = sheet.addRow({
        txHash: tx.txHash,
        date: tx.timestamp instanceof Date ? tx.timestamp.toLocaleString() : String(tx.timestamp),
        employeeName: tx.employeeName,
        employeeEmail: tx.employeeEmail,
        amount: tx.amount,
        assetCode: tx.assetCode,
        status: tx.status,
        batchId: tx.batchId || '',
        memo: tx.memo || '',
      });

      const statusColor =
        tx.status === 'success' ? 'FF38A169' : tx.status === 'failed' ? 'FFE53E3E' : 'FFD69E2E';
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusColor },
      };
      row.getCell('status').font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 9 },
    };
  }

  private async addExcelAssetsBreakdownSheet(
    workbook: ExcelJS.Workbook,
    report: PayrollHistoryReport
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Assets Breakdown');

    sheet.columns = [
      { header: 'Asset Code', key: 'assetCode', width: 15 },
      { header: 'Transaction Count', key: 'count', width: 18 },
      { header: 'Total Amount', key: 'totalAmount', width: 20 },
      { header: 'Percentage', key: 'percentage', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D3748' },
    };

    const assetBreakdown: Record<string, { count: number; totalAmount: number }> = {};
    report.transactions.forEach((tx) => {
      if (!assetBreakdown[tx.assetCode]) {
        assetBreakdown[tx.assetCode] = { count: 0, totalAmount: 0 };
      }
      assetBreakdown[tx.assetCode].count++;
      assetBreakdown[tx.assetCode].totalAmount += parseFloat(tx.amount || '0');
    });

    const totalTx = report.summary.totalTransactions;
    Object.entries(assetBreakdown).forEach(([assetCode, data]) => {
      sheet.addRow({
        assetCode,
        count: data.count,
        totalAmount: data.totalAmount.toFixed(2),
        percentage: `${((data.count / totalTx) * 100).toFixed(2)}%`,
      });
    });

    if (sheet.getRow(2).values) {
      const chart = workbook.addChart('bar', {
        title: { name: 'Transactions by Asset' },
        data: [
          {
            name: 'Transaction Count',
            values: Object.values(assetBreakdown).map((d) => d.count),
            labels: Object.keys(assetBreakdown),
          },
        ],
      } as ExcelJS.Chart);

      sheet.addChart(chart, 'E2', { width: 12, height: 10 });
    }
  }

  private async addAuditExcelSummarySheet(
    workbook: ExcelJS.Workbook,
    report: AuditLogReport
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Summary');

    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 40 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D3748' },
    };

    const summaryRows = [
      { metric: 'Organization', value: report.organizationName },
      { metric: 'Report Generated', value: report.generatedAt.toLocaleString() },
      { metric: 'Period Start', value: report.dateRange.start.toLocaleDateString() },
      { metric: 'Period End', value: report.dateRange.end.toLocaleDateString() },
      { metric: 'Total Actions', value: report.summary.totalActions },
      { metric: 'Successful Transactions', value: report.summary.successfulTransactions },
      { metric: 'Failed Transactions', value: report.summary.failedTransactions },
    ];

    summaryRows.forEach((row) => sheet.addRow(row));

    sheet.addRow([]);
    sheet.addRow({ metric: 'Actions by Type', value: '' }).font = { bold: true };
    Object.entries(report.summary.byAction).forEach(([action, count]) => {
      sheet.addRow({ metric: action.replace(/_/g, ' '), value: count });
    });

    sheet.addRow([]);
    sheet.addRow({ metric: 'Actions by Actor', value: '' }).font = { bold: true };
    Object.entries(report.summary.byActorType).forEach(([actorType, count]) => {
      sheet.addRow({ metric: actorType, value: count });
    });
  }

  private async addAuditExcelLogsSheet(
    workbook: ExcelJS.Workbook,
    report: AuditLogReport
  ): Promise<void> {
    const sheet = workbook.addWorksheet('Audit Logs');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Date', key: 'createdAt', width: 20 },
      { header: 'Action', key: 'action', width: 25 },
      { header: 'Actor Type', key: 'actorType', width: 12 },
      { header: 'Actor Email', key: 'actorEmail', width: 30 },
      { header: 'Employee', key: 'employeeName', width: 25 },
      { header: 'Transaction Hash', key: 'txHash', width: 60 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Asset', key: 'assetCode', width: 10 },
      { header: 'Old Status', key: 'oldStatus', width: 15 },
      { header: 'New Status', key: 'newStatus', width: 15 },
      { header: 'Error', key: 'errorMessage', width: 40 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D3748' },
    };

    report.auditLogs.forEach((log) => {
      const employeeName =
        log.employee_first_name && log.employee_last_name
          ? `${log.employee_first_name} ${log.employee_last_name}`
          : '';

      sheet.addRow({
        id: log.id,
        createdAt:
          log.created_at instanceof Date ? log.created_at.toLocaleString() : String(log.created_at),
        action: log.action.replace(/_/g, ' '),
        actorType: log.actor_type,
        actorEmail: log.actor_email || '',
        employeeName,
        txHash: log.tx_hash || '',
        amount: log.amount || '',
        assetCode: log.asset_code || '',
        oldStatus: log.old_status || '',
        newStatus: log.new_status || '',
        errorMessage: log.error_message || '',
      });
    });

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 12 },
    };
  }

  private async addAuditExcelByActionSheet(
    workbook: ExcelJS.Workbook,
    report: AuditLogReport
  ): Promise<void> {
    const sheet = workbook.addWorksheet('By Action Type');

    sheet.columns = [
      { header: 'Action Type', key: 'action', width: 25 },
      { header: 'Count', key: 'count', width: 15 },
      { header: 'Percentage', key: 'percentage', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D3748' },
    };

    const total = report.summary.totalActions;
    Object.entries(report.summary.byAction)
      .sort((a, b) => b[1] - a[1])
      .forEach(([action, count]) => {
        sheet.addRow({
          action: action.replace(/_/g, ' '),
          count,
          percentage: `${((count / total) * 100).toFixed(2)}%`,
        });
      });
  }

  async saveReport(
    type: 'payroll' | 'audit',
    format: 'pdf' | 'excel' | 'csv',
    filter: ReportFilter,
    filename?: string
  ): Promise<string> {
    this.ensureStorageDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext =
      format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv';
    const defaultFilename = filename || `report-${type}-${timestamp}.${ext}`;
    const filePath = join(this.storageConfig.storagePath, defaultFilename);

    const writeStream = createWriteStream(filePath);

    if (type === 'payroll') {
      if (format === 'pdf') {
        await this.generatePayrollHistoryPdf(filter, writeStream);
      } else if (format === 'excel') {
        await this.generatePayrollHistoryExcel(filter, writeStream);
      } else {
        await this.generatePayrollHistoryCsv(filter, writeStream);
      }
    } else {
      if (format === 'pdf') {
        await this.generateAuditLogPdf(filter, writeStream);
      } else if (format === 'excel') {
        await this.generateAuditLogExcel(filter, writeStream);
      } else {
        await this.generateAuditLogCsv(filter, writeStream);
      }
    }

    logger.info(`Report saved to ${filePath}`, { type, format, filter });
    return filePath;
  }

  private buildCacheKey(type: string, format: string, filter: ReportFilter): string {
    const filterStr = JSON.stringify({
      organizationId: filter.organizationId,
      startDate: filter.startDate?.toISOString(),
      endDate: filter.endDate?.toISOString(),
      payrollRunId: filter.payrollRunId,
      employeeId: filter.employeeId,
      assetCode: filter.assetCode,
    });
    return `${type}:${format}:${Buffer.from(filterStr).toString('base64')}`;
  }

  private redactPii(text: string | null | undefined): string {
    if (!text) return '';
    let result = text;
    if (this.piiRedactionConfig.redactEmails) {
      result = result.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        this.piiRedactionConfig.maskPattern || '****'
      );
    }
    if (this.piiRedactionConfig.redactPhoneNumbers) {
      result = result.replace(
        /(\+?1?\s*)?(\([0-9]{3}\)|[0-9]{3})[- ]?[0-9]{3}[- ]?[0-9]{4}/g,
        this.piiRedactionConfig.maskPattern || '****'
      );
    }
    return result;
  }

  private redactTransaction(
    tx: TransactionReportItem
  ): TransactionReportItem {
    return {
      ...tx,
      employeeName: this.piiRedactionConfig.redactNames ? this.piiRedactionConfig.maskPattern || '****' : tx.employeeName,
      employeeEmail: this.piiRedactionConfig.redactEmails ? this.piiRedactionConfig.maskPattern || '****' : tx.employeeEmail,
      memo: this.piiRedactionConfig.redactMemos ? this.piiRedactionConfig.maskPattern || '****' : tx.memo,
    };
  }

  async generatePayrollHistoryCsv(
    filter: ReportFilter,
    stream: NodeJS.WritableStream
  ): Promise<void> {
    const report = await this.buildPayrollHistoryReport(filter);
    const output = csv.format({ headers: true });
    output.pipe(stream);
    for (const tx of report.transactions) {
      output.write({
        txHash: tx.txHash,
        employeeId: tx.employeeId,
        employeeName: tx.employeeName,
        employeeEmail: tx.employeeEmail,
        amount: tx.amount,
        assetCode: tx.assetCode,
        status: tx.status,
        timestamp: tx.timestamp.toISOString(),
        batchId: tx.batchId,
        memo: tx.memo,
      });
    }
    output.end();
  }

  async generateAuditLogCsv(
    filter: ReportFilter,
    stream: NodeJS.WritableStream
  ): Promise<void> {
    const report = await this.buildAuditLogReport(filter);
    const output = csv.format({ headers: true });
    output.pipe(stream);
    for (const log of report.auditLogs) {
      output.write({
        timestamp: new Date(log.timestamp).toISOString(),
        action: log.action,
        actorType: log.actorType,
        actorId: log.actorId,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        status: log.status,
        details: JSON.stringify(log.details),
      });
    }
    output.end();
  }

  async cacheReport(
    type: 'payroll' | 'audit',
    format: 'pdf' | 'excel' | 'csv',
    filter: ReportFilter,
    data: unknown
  ): Promise<void> {
    const key = this.buildCacheKey(type, format, filter);
    await this.cache.set(key, { data, format, timestamp: Date.now() }, 60 * 60);
  }

  async getCachedReport(
    type: 'payroll' | 'audit',
    format: 'pdf' | 'excel' | 'csv',
    filter: ReportFilter
  ): Promise<CachedReport | null> {
    const key = this.buildCacheKey(type, format, filter);
    return this.cache.get<CachedReport>(key);
  }

  async clearReportCache(type: 'payroll' | 'audit', organizationId: number): Promise<void> {
    const cachePrefix = `reports:${type}`;
    logger.info(`Clearing report cache for ${type}`, { organizationId });
  }

  async recordReportVersion(
    reportId: string,
    version: number,
    filter: ReportFilter,
    format: 'pdf' | 'excel' | 'csv',
    filePath: string
  ): Promise<ReportVersion> {
    const stats = statSync(filePath);
    const crypto = await import('crypto');
    const content = (await import('fs/promises')).readFile(filePath);
    const checksum = crypto.createHash('sha256').update(await content).digest('hex');
    const reportVersion: ReportVersion = {
      id: `${reportId}-v${version}-${Date.now()}`,
      reportId,
      version,
      generatedAt: new Date(),
      filters: filter,
      format,
      filePath,
      size: stats.size,
      checksum,
    };
    const versions = this.reportVersions.get(reportId) || [];
    versions.push(reportVersion);
    this.reportVersions.set(reportId, versions);
    return reportVersion;
  }

  async getReportVersionHistory(
    reportId: string
  ): Promise<ReportVersion[]> {
    return this.reportVersions.get(reportId) || [];
  }

  async compareReportVersions(
    reportId: string,
    versionA: number,
    versionB: number
  ): Promise<{ added: unknown[]; removed: unknown[]; modified: unknown[] }> {
    const versions = this.reportVersions.get(reportId) || [];
    const v1 = versions.find((v) => v.version === versionA);
    const v2 = versions.find((v) => v.version === versionB);
    if (!v1 || !v2) {
      throw new Error(`Version not found for report ${reportId}`);
    }
    return {
      added: [],
      removed: [],
      modified: [],
    };
  }

  getStoredReport(filename: string): NodeJS.ReadableStream {
    const filePath = join(this.storageConfig.storagePath, filename);
    return createReadStream(filePath);
  }

  async cleanupOldReports(): Promise<number> {
    this.ensureStorageDirectory();

    const fs = await import('fs/promises');
    const files = await fs.readdir(this.storageConfig.storagePath);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = join(this.storageConfig.storagePath, file);
      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > this.storageConfig.maxAgeMs) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Deleted old report: ${file}`);
        }
      } catch (error) {
        logger.warn(`Failed to process file ${file}`, { error });
      }
    }

    return deletedCount;
  }
}

export const advancedReportService = new AdvancedReportService();
