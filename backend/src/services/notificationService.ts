import { query } from '../config/database.js';
import { IEmailProvider, EmailSendResult } from './email/emailProvider.interface.js';
import {
  EmailProviderFactory,
  EmailProviderType,
} from './email/emailProviderFactory.js';
import { TemplateRenderer, TemplateData } from './templateRenderer.js';
import {
  NotificationConfig,
  NotificationConfigService,
} from './notificationConfigService.js';
import { NotificationTrackingService } from './notificationTrackingService.js';
import { PushNotificationService, PushResult } from './pushNotificationService.js';
import logger from '../utils/logger.js';
import { config } from '../config/env.js';

export interface NotificationOptions {
  organizationId: number;
  employeeId: number;
  transactionId: number;
  transactionHash: string;
  amount: string;
  assetCode: string;
  timestamp: string;
}

export interface NotificationResult {
  email: EmailSendResult;
  push: PushResult;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  locale: string;
}

interface Organization {
  id: number;
  name: string;
}

export class NotificationService {
  private emailProvider: IEmailProvider | null = null;
  private templateRenderer: TemplateRenderer;
  private configService: NotificationConfigService;
  private trackingService: NotificationTrackingService;
  private pushService: PushNotificationService;

  constructor() {
    this.templateRenderer = new TemplateRenderer();
    this.configService = new NotificationConfigService();
    this.trackingService = new NotificationTrackingService();
    this.pushService = new PushNotificationService();
  }

  async sendPaymentNotification(
    options: NotificationOptions
  ): Promise<NotificationResult> {
    const {
      organizationId,
      employeeId,
      transactionId,
      transactionHash,
      amount,
      assetCode,
      timestamp,
    } = options;

    try {
      // Fetch employee and organization data
      const employee = await this.getEmployee(employeeId, organizationId);
      const organization = await this.getOrganization(organizationId);
      const notificationConfig = await this.configService.getConfig(organizationId);

      // Send email notification
      const emailResult = await this.sendEmail(
        employee,
        organization,
        notificationConfig,
        {
          transactionId,
          transactionHash,
          amount,
          assetCode,
          timestamp,
        }
      );

      // Send push notification (isolated from email failure)
      const pushResult = await this.sendPush(
        employee,
        organization,
        notificationConfig,
        {
          transactionId,
          transactionHash,
          amount,
          assetCode,
          timestamp,
        }
      );

      return {
        email: emailResult,
        push: pushResult,
      };
    } catch (error) {
      logger.error('Notification service error', {
        organizationId,
        employeeId,
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return failure for both
      return {
        email: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        push: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async sendEmail(
    employee: Employee,
    organization: Organization,
    notificationConfig: NotificationConfig,
    paymentData: {
      transactionId: number;
      transactionHash: string;
      amount: string;
      assetCode: string;
      timestamp: string;
    }
  ): Promise<EmailSendResult> {
    try {
      // Check if email is enabled
      if (!notificationConfig.emailEnabled) {
        logger.info('Email notifications disabled for organization', {
          organizationId: organization.id,
        });
        return { success: true, messageId: 'disabled' };
      }

      // Check if employee has email
      if (!employee.email) {
        logger.warn('Employee has no email address, skipping email notification', {
          employeeId: employee.id,
          organizationId: organization.id,
        });
        return { success: true, messageId: 'no-email' };
      }

      // Prepare template data
      const stellarExplorerUrl =
        config.STELLAR_EXPLORER_URL || 'https://stellar.expert/explorer/public/tx';
      const templateData: TemplateData = {
        employeeFirstName: employee.first_name,
        employeeLastName: employee.last_name,
        amount: paymentData.amount,
        currency: paymentData.assetCode,
        transactionHash: paymentData.transactionHash,
        transactionUrl: `${stellarExplorerUrl}/${paymentData.transactionHash}`,
        paymentDate: paymentData.timestamp,
        organizationName: organization.name,
        locale: employee.locale || notificationConfig.locale || 'en',
      };

      // Render templates
      const html = this.templateRenderer.renderHtml(
        'payment-notification',
        templateData
      );
      const text = this.templateRenderer.renderText(
        'payment-notification',
        templateData
      );

      // Send email
      if (!this.emailProvider) {
        this.emailProvider = this.initializeEmailProvider(notificationConfig.emailProvider);
      }

      if (!this.emailProvider) {
        throw new Error('Email provider not initialized');
      }

      const result = await this.emailProvider.send({
        to: employee.email,
        from: `${notificationConfig.fromName} <${notificationConfig.fromEmail}>`,
        subject: `Payment Received - ${paymentData.amount} ${paymentData.assetCode}`,
        html,
        text,
      });

      // Track result
      if (result.success && result.messageId) {
        await this.trackingService.recordEmailSent(
          paymentData.transactionId,
          employee.id,
          organization.id,
          result.messageId
        );
      } else {
        await this.trackingService.recordEmailFailed(
          paymentData.transactionId,
          employee.id,
          organization.id,
          result.error || 'Unknown error'
        );
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Email sending error', {
        employeeId: employee.id,
        organizationId: organization.id,
        error: errorMessage,
      });

      // Track failure
      try {
        await this.trackingService.recordEmailFailed(
          paymentData.transactionId,
          employee.id,
          organization.id,
          errorMessage
        );
      } catch (trackingError) {
        logger.error('Failed to track email failure', {
          error:
            trackingError instanceof Error
              ? trackingError.message
              : 'Unknown error',
        });
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async sendPush(
    employee: Employee,
    organization: Organization,
    notificationConfig: NotificationConfig,
    paymentData: {
      transactionId: number;
      transactionHash: string;
      amount: string;
      assetCode: string;
      timestamp: string;
    }
  ): Promise<PushResult> {
    try {
      // Check if push is enabled
      if (!notificationConfig.pushEnabled) {
        logger.info('Push notifications disabled for organization', {
          organizationId: organization.id,
        });
        return { success: true, messageId: 'disabled' };
      }

      // Send push notification
      const result = await this.pushService.send(
        employee.id,
        'Payment Received',
        `You received ${paymentData.amount} ${paymentData.assetCode}`,
        {
          type: 'payment',
          transactionId: paymentData.transactionId.toString(),
          transactionHash: paymentData.transactionHash,
          amount: paymentData.amount,
          currency: paymentData.assetCode,
        }
      );

      // Track result
      if (result.success && result.messageId) {
        await this.trackingService.recordPushSent(
          paymentData.transactionId,
          employee.id,
          organization.id,
          result.messageId
        );
      } else if (!result.success) {
        await this.trackingService.recordPushFailed(
          paymentData.transactionId,
          employee.id,
          organization.id,
          result.error || 'Unknown error'
        );
      }

      return result;
    } catch (error) {
      // Push failures should not fail the entire notification job
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Push notification error (isolated)', {
        employeeId: employee.id,
        organizationId: organization.id,
        error: errorMessage,
      });

      // Track failure
      try {
        await this.trackingService.recordPushFailed(
          paymentData.transactionId,
          employee.id,
          organization.id,
          errorMessage
        );
      } catch (trackingError) {
        logger.error('Failed to track push failure', {
          error:
            trackingError instanceof Error
              ? trackingError.message
              : 'Unknown error',
        });
      }

      // Return success to prevent job retry
      return {
        success: true,
        messageId: 'push-failed-isolated',
        error: errorMessage,
      };
    }
  }

  private async getEmployee(
    employeeId: number,
    organizationId: number
  ): Promise<Employee> {
    const result = await query(
      `SELECT id, first_name, last_name, email, locale
      FROM employees
      WHERE id = $1 AND organization_id = $2`,
      [employeeId, organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    return result.rows[0];
  }

  private async getOrganization(organizationId: number): Promise<Organization> {
    const result = await query(
      'SELECT id, name FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    return result.rows[0];
  }

  private initializeEmailProvider(providerType: EmailProviderType): IEmailProvider {
    const apiKey =
      providerType === EmailProviderType.RESEND
        ? config.RESEND_API_KEY
        : config.SENDGRID_API_KEY;

    if (!apiKey) {
      throw new Error(
        `Missing API key for email provider: ${providerType}. Please set ${providerType === EmailProviderType.RESEND ? 'RESEND_API_KEY' : 'SENDGRID_API_KEY'} environment variable.`
      );
    }

    const fromEmail = config.EMAIL_FROM_ADDRESS || 'noreply@payd.example.com';

    return EmailProviderFactory.create({
      type: providerType,
      apiKey,
      fromEmail,
    });
  }
}
