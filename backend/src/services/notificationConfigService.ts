import { query } from '../config/database.js';
import { EmailProviderType } from './email/emailProviderFactory.js';
import logger from '../utils/logger.js';

export interface NotificationConfig {
  organizationId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  emailProvider: EmailProviderType;
  fromEmail: string;
  fromName: string;
  locale: string;
}

export class NotificationConfigService {
  async getConfig(organizationId: number): Promise<NotificationConfig> {
    try {
      const result = await query(
        `SELECT 
          organization_id,
          email_enabled,
          push_enabled,
          email_provider,
          from_email,
          from_name,
          locale
        FROM notification_configs
        WHERE organization_id = $1`,
        [organizationId]
      );

      if (result.rows.length === 0) {
        // Return default configuration
        logger.info('No notification config found, using defaults', {
          organizationId,
        });
        return this.getDefaultConfig(organizationId);
      }

      const row = result.rows[0];
      return {
        organizationId: row.organization_id,
        emailEnabled: row.email_enabled,
        pushEnabled: row.push_enabled,
        emailProvider: row.email_provider as EmailProviderType,
        fromEmail: row.from_email,
        fromName: row.from_name,
        locale: row.locale,
      };
    } catch (error) {
      logger.error('Error fetching notification config', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async updateConfig(
    organizationId: number,
    config: Partial<Omit<NotificationConfig, 'organizationId'>>
  ): Promise<void> {
    try {
      // Validate email provider if provided
      if (config.emailProvider && !Object.values(EmailProviderType).includes(config.emailProvider)) {
        throw new Error(
          `Invalid email provider: ${config.emailProvider}. Must be one of: ${Object.values(EmailProviderType).join(', ')}`
        );
      }

      // Check if config exists
      const existingConfig = await query(
        'SELECT id FROM notification_configs WHERE organization_id = $1',
        [organizationId]
      );

      if (existingConfig.rows.length === 0) {
        // Insert new config
        await query(
          `INSERT INTO notification_configs (
            organization_id,
            email_enabled,
            push_enabled,
            email_provider,
            from_email,
            from_name,
            locale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            organizationId,
            config.emailEnabled ?? true,
            config.pushEnabled ?? false,
            config.emailProvider ?? EmailProviderType.RESEND,
            config.fromEmail ?? process.env.EMAIL_FROM_ADDRESS ?? 'noreply@payd.example.com',
            config.fromName ?? process.env.EMAIL_FROM_NAME ?? 'PayD Payroll',
            config.locale ?? 'en',
          ]
        );
      } else {
        // Update existing config
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (config.emailEnabled !== undefined) {
          updates.push(`email_enabled = $${paramIndex++}`);
          values.push(config.emailEnabled);
        }
        if (config.pushEnabled !== undefined) {
          updates.push(`push_enabled = $${paramIndex++}`);
          values.push(config.pushEnabled);
        }
        if (config.emailProvider !== undefined) {
          updates.push(`email_provider = $${paramIndex++}`);
          values.push(config.emailProvider);
        }
        if (config.fromEmail !== undefined) {
          updates.push(`from_email = $${paramIndex++}`);
          values.push(config.fromEmail);
        }
        if (config.fromName !== undefined) {
          updates.push(`from_name = $${paramIndex++}`);
          values.push(config.fromName);
        }
        if (config.locale !== undefined) {
          updates.push(`locale = $${paramIndex++}`);
          values.push(config.locale);
        }

        if (updates.length > 0) {
          values.push(organizationId);
          await query(
            `UPDATE notification_configs 
            SET ${updates.join(', ')}
            WHERE organization_id = $${paramIndex}`,
            values
          );
        }
      }

      logger.info('Notification config updated', {
        organizationId,
        updates: Object.keys(config),
      });
    } catch (error) {
      logger.error('Error updating notification config', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private getDefaultConfig(organizationId: number): NotificationConfig {
    return {
      organizationId,
      emailEnabled: true,
      pushEnabled: false,
      emailProvider: EmailProviderType.RESEND,
      fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@payd.example.com',
      fromName: process.env.EMAIL_FROM_NAME || 'PayD Payroll',
      locale: 'en',
    };
  }
}
