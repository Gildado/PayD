import nodemailer from 'nodemailer';
import type { Attachment, Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { PassThrough } from 'stream';
import logger from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';
import {
  DeliveryChannel,
  ReportFormat,
  type DeliveryConfig,
  type IReportDelivery,
  type ReportResult,
} from '../reportSchema.js';
import {
  ExportService,
  type CustomReportColumn,
  type CustomReportRow,
} from '../exportService.js';
import { createExportDownloadToken } from '../../utils/exportDownloadToken.js';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SIGNED_LINK_TTL_SEC = 900;

/**
 * Email Delivery Channel
 * Delivers reports via email with configurable templates and recipients
 */
export class EmailDeliveryChannel implements IReportDelivery {
  channel = DeliveryChannel.EMAIL;
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  private initializeTransporter(): void {
    // Using environment variables for email configuration
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  /**
   * Delivers report via email
   */
  async deliver(result: ReportResult, config: DeliveryConfig): Promise<void> {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const validation = await this.validateConfig(config);
      if (!validation) {
        throw new Error('Invalid email configuration');
      }

      const recipients = config.config.recipients || [];
      if (recipients.length === 0) {
        throw new Error('No recipients configured');
      }

      const subject = config.config.subject || 'Report Generated';
      const { attachments, downloadLink } = await this.buildAttachments(result);
      const htmlContent = this.buildEmailContent(result, config, downloadLink);

      const retryPolicy = config.retryPolicy || {
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
      };

      await withRetry(
        async () => {
          await this.transporter!.sendMail({
            from: process.env.SMTP_FROM || 'noreply@payd.app',
            to: recipients,
            subject,
            html: htmlContent,
            attachments,
          });
        },
        {
          maxRetries: retryPolicy.maxRetries,
          baseDelayMs: retryPolicy.backoffMs,
          backoffMultiplier: retryPolicy.backoffMultiplier,
          retryableErrors: [
            '421',
            '450',
            '451',
            '452',
            'rate limit',
            'throttle',
            'temporary',
            'timeout',
          ],
          onRetry: (attempt, error) => {
            logger.warn('Retrying email report delivery', {
              attempt,
              executionId: result.executionId,
              error: error.message,
            });
          },
        }
      );

      logger.info(
        `Report delivered via email to ${recipients.join(', ')} (execution: ${result.executionId})`
      );
    } catch (error) {
      logger.error('Error delivering report via email:', error);
      throw error;
    }
  }

  /**
   * Validates email configuration
   */
  async validateConfig(config: DeliveryConfig): Promise<boolean> {
    try {
      // Check required fields
      if (!config.config.recipients || config.config.recipients.length === 0) {
        logger.warn('No email recipients configured');
        return false;
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of config.config.recipients) {
        if (!emailRegex.test(email)) {
          logger.warn(`Invalid email address: ${email}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error validating email config:', error);
      return false;
    }
  }

  /**
   * Builds email HTML content
   */
  private buildEmailContent(
    result: ReportResult,
    config: DeliveryConfig,
    downloadLink: string | null
  ): string {
    const title = config.config.subject || 'Report Generated';
    const timestamp = new Date(result.summary.generatedAt).toLocaleString();
    const recordCount = result.summary.totalRecords;
    const downloadSection = downloadLink
      ? `<p><a href="${downloadLink}">Download the report</a></p>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
            .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
            .summary-item { background: white; padding: 10px; border-radius: 3px; }
            .summary-item label { font-weight: bold; display: block; color: #666; font-size: 0.9em; }
            .summary-item value { font-size: 1.3em; color: #007bff; }
            .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 0.85em; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${title}</h1>
            </div>
            <div class="content">
              <p>Your report has been successfully generated.</p>
              ${downloadSection}

              <div class="summary">
                <div class="summary-item">
                  <label>Total Records</label>
                  <value>${recordCount}</value>
                </div>
                <div class="summary-item">
                  <label>Processed Records</label>
                  <value>${result.summary.processedRecords}</value>
                </div>
                <div class="summary-item">
                  <label>Failed Records</label>
                  <value>${result.summary.failedRecords}</value>
                </div>
                <div class="summary-item">
                  <label>Format</label>
                  <value>${result.format}</value>
                </div>
              </div>

              <div class="footer">
                <p>Generated: ${timestamp}</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private async buildAttachments(result: ReportResult): Promise<{
    attachments: Attachment[];
    downloadLink: string | null;
  }> {
    if (result.format !== ReportFormat.CSV && result.format !== ReportFormat.PDF) {
      return { attachments: [], downloadLink: null };
    }

    const data = result.data ?? [];
    if (data.length === 0) {
      return { attachments: [], downloadLink: this.buildDownloadLink(result) };
    }

    const columns: CustomReportColumn[] = Object.keys(data[0] ?? {}).map((key) => ({
      key,
      label: key,
    }));
    const content = await this.renderReport(result, columns, data as CustomReportRow[]);

    if (content.length > MAX_ATTACHMENT_BYTES) {
      return { attachments: [], downloadLink: this.buildDownloadLink(result) };
    }

    const isCsv = result.format === ReportFormat.CSV;
    return {
      attachments: [
        {
          filename: `report-${result.executionId}.${isCsv ? 'csv' : 'pdf'}`,
          content,
          contentType: isCsv ? 'text/csv' : 'application/pdf',
        },
      ],
      downloadLink: null,
    };
  }

  private async renderReport(
    result: ReportResult,
    columns: CustomReportColumn[],
    rows: CustomReportRow[]
  ): Promise<Buffer> {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

    if (result.format === ReportFormat.CSV) {
      await ExportService.generateCustomCsv(columns, rows, stream);
    } else {
      await ExportService.generateCustomPdf(`Report ${result.executionId}`, columns, rows, stream);
    }

    return Buffer.concat(chunks);
  }

  private buildDownloadLink(result: ReportResult): string | null {
    if (result.format !== ReportFormat.CSV && result.format !== ReportFormat.PDF) {
      return null;
    }

    const token = createExportDownloadToken({
      kind: 'report',
      executionId: result.executionId,
      format: result.format,
      exp: Math.floor(Date.now() / 1000) + SIGNED_LINK_TTL_SEC,
    });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/reports/${encodeURIComponent(result.executionId)}?token=${encodeURIComponent(token)}`;
  }
}

export default EmailDeliveryChannel;
