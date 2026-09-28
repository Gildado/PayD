import { pool } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { DeliveryConfig, ReportResult, DeliveryChannel } from '../reportSchema.js';
import { IReportDelivery } from '../reportSchema.js';

/**
 * In-App Delivery Channel
 * Delivers reports as in-app notifications stored in database
 */
export class InAppDeliveryChannel implements IReportDelivery {
  channel = DeliveryChannel.IN_APP;

  /**
   * Delivers report via in-app notification
   */
  async deliver(result: ReportResult, config: DeliveryConfig): Promise<void> {
    try {
      const validation = await this.validateConfig(config);
      if (!validation) {
        throw new Error('Invalid in-app configuration');
      }

      // Create in-app notification
      const notificationId = crypto.randomUUID();
      const now = new Date();

      await pool.query(
        `
        INSERT INTO in_app_notifications
        (id, type, title, message, payload, read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          notificationId,
          'REPORT_GENERATED',
          config.config.notificationTitle || 'Report Ready',
          config.config.notificationMessage || 'Your report has been generated',
          JSON.stringify(this.buildNotificationPayload(result, config)),
          false,
          now,
          now,
        ]
      );

      logger.info(
        `Report delivered as in-app notification (id: ${notificationId}, execution: ${result.executionId})`
      );
    } catch (error) {
      logger.error('Error delivering report via in-app notification:', error);
      throw error;
    }
  }

  /**
   * Validates in-app configuration
   */
  async validateConfig(config: DeliveryConfig): Promise<boolean> {
    try {
      // Check that notification title and message are present
      if (
        !config.config.notificationTitle ||
        !config.config.notificationMessage
      ) {
        logger.warn('Notification title and message required');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating in-app config:', error);
      return false;
    }
  }

  /**
   * Builds notification payload
   */
  private buildNotificationPayload(
    result: ReportResult,
    config: DeliveryConfig
  ): Record<string, any> {
    return {
      type: 'REPORT_GENERATED',
      reportId: result.executionId,
      format: result.format,
      summary: {
        totalRecords: result.summary.totalRecords,
        processedRecords: result.summary.processedRecords,
        failedRecords: result.summary.failedRecords,
        generatedAt: result.summary.generatedAt,
      },
      action: {
        type: 'VIEW_REPORT',
        url: `/reports/${result.executionId}`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Marks notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await pool.query(
        `
        UPDATE in_app_notifications
        SET read = true, updated_at = NOW()
        WHERE id = $1
      `,
        [notificationId]
      );

      logger.info(`Marked notification as read: ${notificationId}`);
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Gets unread notifications for user
   */
  async getUnreadNotifications(userId: number, limit = 20): Promise<any[]> {
    try {
      const result = await pool.query(
        `
        SELECT * FROM in_app_notifications
        WHERE user_id = $1 AND read = false
        ORDER BY created_at DESC
        LIMIT $2
      `,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching unread notifications:', error);
      return [];
    }
  }

  /**
   * Deletes notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await pool.query(
        `
        DELETE FROM in_app_notifications
        WHERE id = $1
      `,
        [notificationId]
      );

      logger.info(`Deleted notification: ${notificationId}`);
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }
}

export default InAppDeliveryChannel;
