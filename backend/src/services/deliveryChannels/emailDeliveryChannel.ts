import nodemailer from 'nodemailer';
import logger from '../../utils/logger.js';
import { DeliveryConfig, ReportResult, DeliveryChannel } from '../reportSchema.js';
import { IReportDelivery } from '../reportSchema.js';

/**
 * Email Delivery Channel
 * Delivers reports via email with configurable templates and recipients
 */
export class EmailDeliveryChannel implements IReportDelivery {
  channel = DeliveryChannel.EMAIL;
  private transporter: nodemailer.Transporter | null = null;

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
      auth: user && password ? { user, password } : undefined,
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

      // Build email content
      const subject = config.config.subject || 'Report Generated';
      const htmlContent = this.buildEmailContent(result, config);

      // Send email
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@payd.app',
        to: recipients,
        subject,
        html: htmlContent,
        attachments: await this.buildAttachments(result),
      });

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
  private buildEmailContent(result: ReportResult, config: DeliveryConfig): string {
    const title = config.config.subject || 'Report Generated';
    const timestamp = new Date(result.summary.generatedAt).toLocaleString();
    const recordCount = result.summary.totalRecords;

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

  /**
   * Builds email attachments
   */
  private async buildAttachments(result: ReportResult): Promise<any[]> {
    // TODO: Add attachment generation based on result format
    // This would attach the actual report file if stored
    return [];
  }
}

export default EmailDeliveryChannel;
