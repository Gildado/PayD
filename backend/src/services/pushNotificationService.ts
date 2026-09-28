import { query } from '../config/database.js';
import logger from '../utils/logger.js';

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PushToken {
  employeeId: number;
  token: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: Date;
}

export class PushNotificationService {
  async send(
    employeeId: number,
    title: string,
    body: string,
    data: Record<string, string>
  ): Promise<PushResult> {
    try {
      // Get all tokens for this employee
      const tokens = await this.getTokensForEmployee(employeeId);

      if (tokens.length === 0) {
        logger.info('No push tokens found for employee', { employeeId });
        return {
          success: true,
          messageId: 'no-tokens',
        };
      }

      // Stub implementation - log the notification
      logger.info('Push notification stub - would send to devices', {
        employeeId,
        title,
        body,
        data,
        tokenCount: tokens.length,
        platforms: tokens.map((t) => t.platform),
      });

      // In a real implementation, this would:
      // 1. Use a service like Firebase Cloud Messaging (FCM) for Android
      // 2. Use Apple Push Notification service (APNs) for iOS
      // 3. Use Web Push API for web notifications
      // 4. Handle token expiration and cleanup
      // 5. Batch notifications for efficiency

      return {
        success: true,
        messageId: `stub-${Date.now()}`,
      };
    } catch (error) {
      logger.error('Push notification error', {
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async registerToken(
    employeeId: number,
    token: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO push_tokens (employee_id, token, platform)
        VALUES ($1, $2, $3)
        ON CONFLICT (employee_id, token) 
        DO UPDATE SET platform = $3, updated_at = NOW()`,
        [employeeId, token, platform]
      );

      logger.info('Push token registered', {
        employeeId,
        platform,
        tokenPrefix: token.substring(0, 10) + '...',
      });
    } catch (error) {
      logger.error('Error registering push token', {
        employeeId,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async removeToken(employeeId: number, token: string): Promise<void> {
    try {
      await query(
        'DELETE FROM push_tokens WHERE employee_id = $1 AND token = $2',
        [employeeId, token]
      );

      logger.info('Push token removed', {
        employeeId,
        tokenPrefix: token.substring(0, 10) + '...',
      });
    } catch (error) {
      logger.error('Error removing push token', {
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async getTokensForEmployee(employeeId: number): Promise<PushToken[]> {
    try {
      const result = await query(
        `SELECT employee_id, token, platform, created_at
        FROM push_tokens
        WHERE employee_id = $1`,
        [employeeId]
      );

      return result.rows.map((row) => ({
        employeeId: row.employee_id,
        token: row.token,
        platform: row.platform,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error fetching push tokens', {
        employeeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
