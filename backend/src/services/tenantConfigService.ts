import { Pool } from 'pg';
import { pool } from '../config/database';

export interface TenantConfig {
  id: number;
  organization_id: number;
  config_key: string;
  config_value: any;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentSettings {
  default_currency: string;
  auto_approve_threshold: number;
  require_dual_approval: boolean;
}

export interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  webhook_url?: string;
}

export interface SecuritySettings {
  session_timeout_minutes: number;
  require_2fa: boolean;
  ip_whitelist: string[];
}

export interface BrandingSettings {
  logo_url?: string;
  primary_color: string;
  company_name?: string;
}

export class TenantConfigService {
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    this.pool = dbPool;
  }

  /**
   * Get a specific configuration by key
   */
  async getConfig(organizationId: number, configKey: string): Promise<any | null> {
    const query = `
      SELECT config_value
      FROM tenant_configurations
      WHERE organization_id = $1 AND config_key = $2
    `;

    const result = await this.pool.query(query, [organizationId, configKey]);
    return result.rows[0]?.config_value || null;
  }

  /**
   * Get all configurations for a tenant
   */
  async getAllConfigs(organizationId: number): Promise<Record<string, any>> {
    const query = `
      SELECT config_key, config_value
      FROM tenant_configurations
      WHERE organization_id = $1
      ORDER BY config_key
    `;

    const result = await this.pool.query(query, [organizationId]);
    
    const configs: Record<string, any> = {};
    result.rows.forEach(row => {
      configs[row.config_key] = row.config_value;
    });

    return configs;
  }

  /**
   * Set or update a configuration
   */
  async setConfig(
    organizationId: number,
    configKey: string,
    configValue: any,
    description?: string
  ): Promise<TenantConfig> {
    const query = `
      INSERT INTO tenant_configurations (organization_id, config_key, config_value, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (organization_id, config_key)
      DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = COALESCE(EXCLUDED.description, tenant_configurations.description),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      organizationId,
      configKey,
      JSON.stringify(configValue),
      description,
    ]);

    return result.rows[0];
  }

  /**
   * Delete a configuration
   */
  async deleteConfig(organizationId: number, configKey: string): Promise<boolean> {
    const query = `
      DELETE FROM tenant_configurations
      WHERE organization_id = $1 AND config_key = $2
      RETURNING id
    `;

    const result = await this.pool.query(query, [organizationId, configKey]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get payment settings
   */
  async getPaymentSettings(organizationId: number): Promise<PaymentSettings | null> {
    return this.getConfig(organizationId, 'payment_settings');
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(
    organizationId: number,
    settings: Partial<PaymentSettings>
  ): Promise<TenantConfig> {
    const current = await this.getPaymentSettings(organizationId);
    const updated = { ...current, ...settings };
    return this.setConfig(organizationId, 'payment_settings', updated);
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(organizationId: number): Promise<NotificationSettings | null> {
    return this.getConfig(organizationId, 'notification_settings');
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    organizationId: number,
    settings: Partial<NotificationSettings>
  ): Promise<TenantConfig> {
    const current = await this.getNotificationSettings(organizationId);
    const updated = { ...current, ...settings };
    return this.setConfig(organizationId, 'notification_settings', updated);
  }

  /**
   * Get security settings
   */
  async getSecuritySettings(organizationId: number): Promise<SecuritySettings | null> {
    return this.getConfig(organizationId, 'security_settings');
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(
    organizationId: number,
    settings: Partial<SecuritySettings>
  ): Promise<TenantConfig> {
    const current = await this.getSecuritySettings(organizationId);
    const updated = { ...current, ...settings };
    return this.setConfig(organizationId, 'security_settings', updated);
  }

  /**
   * Get branding settings
   */
  async getBrandingSettings(organizationId: number): Promise<BrandingSettings | null> {
    return this.getConfig(organizationId, 'branding');
  }

  /**
   * Update branding settings
   */
  async updateBrandingSettings(
    organizationId: number,
    settings: Partial<BrandingSettings>
  ): Promise<TenantConfig> {
    const current = await this.getBrandingSettings(organizationId);
    const updated = { ...current, ...settings };
    return this.setConfig(organizationId, 'branding', updated);
  }
}

export default new TenantConfigService();
