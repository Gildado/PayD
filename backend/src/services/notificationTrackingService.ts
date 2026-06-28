import { query } from '../config/database.js';
import logger from '../utils/logger.js';

export interface NotificationRecord {
  id: number;
  transactionId: number;
  employeeId: number;
  organizationId: number;
  notificationType: 'email' | 'push';
  status: 'sent' | 'failed' | 'pending';
  messageId?: string;
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
}

export interface QueryOptions {
  notificationType?: 'email' | 'push';
  status?: 'sent' | 'failed' | 'pending';
  page?: number;
  limit?: number;
}

export class NotificationTrackingService {
  async recordEmailSent(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    messageId: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO notifications (
          transaction_id,
          employee_id,
          organization_id,
          notification_type,
          status,
          message_id,
          sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [transactionId, employeeId, organizationId, 'email', 'sent', messageId]
      );

      logger.info('Email notification recorded as sent', {
        transactionId,
        employeeId,
        organizationId,
        messageId,
      });
    } catch (error) {
      logger.error('Error recording email sent', {
        transactionId,
        employeeId,
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async recordEmailFailed(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    error: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO notifications (
          transaction_id,
          employee_id,
          organization_id,
          notification_type,
          status,
          error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [transactionId, employeeId, organizationId, 'email', 'failed', error]
      );

      logger.info('Email notification recorded as failed', {
        transactionId,
        employeeId,
        organizationId,
        error,
      });
    } catch (dbError) {
      logger.error('Error recording email failure', {
        transactionId,
        employeeId,
        organizationId,
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
      });
      throw dbError;
    }
  }

  async recordPushSent(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    messageId: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO notifications (
          transaction_id,
          employee_id,
          organization_id,
          notification_type,
          status,
          message_id,
          sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [transactionId, employeeId, organizationId, 'push', 'sent', messageId]
      );

      logger.info('Push notification recorded as sent', {
        transactionId,
        employeeId,
        organizationId,
        messageId,
      });
    } catch (error) {
      logger.error('Error recording push sent', {
        transactionId,
        employeeId,
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async recordPushFailed(
    transactionId: number,
    employeeId: number,
    organizationId: number,
    error: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO notifications (
          transaction_id,
          employee_id,
          organization_id,
          notification_type,
          status,
          error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [transactionId, employeeId, organizationId, 'push', 'failed', error]
      );

      logger.info('Push notification recorded as failed', {
        transactionId,
        employeeId,
        organizationId,
        error,
      });
    } catch (dbError) {
      logger.error('Error recording push failure', {
        transactionId,
        employeeId,
        organizationId,
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
      });
      throw dbError;
    }
  }

  async getNotificationHistory(
    employeeId: number,
    organizationId: number,
    options: QueryOptions = {}
  ): Promise<{ data: NotificationRecord[]; total: number }> {
    try {
      const {
        notificationType,
        status,
        page = 1,
        limit = 20,
      } = options;

      const offset = (page - 1) * limit;
      const conditions: string[] = [
        'employee_id = $1',
        'organization_id = $2',
      ];
      const params: any[] = [employeeId, organizationId];
      let paramIndex = 3;

      if (notificationType) {
        conditions.push(`notification_type = $${paramIndex++}`);
        params.push(notificationType);
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results
      params.push(limit, offset);
      const result = await query(
        `SELECT 
          id,
          transaction_id,
          employee_id,
          organization_id,
          notification_type,
          status,
          message_id,
          error_message,
          sent_at,
          created_at
        FROM notifications
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params
      );

      const data = result.rows.map((row) => ({
        id: row.id,
        transactionId: row.transaction_id,
        employeeId: row.employee_id,
        organizationId: row.organization_id,
        notificationType: row.notification_type,
        status: row.status,
        messageId: row.message_id,
        errorMessage: row.error_message,
        sentAt: row.sent_at,
        createdAt: row.created_at,
      }));

      return { data, total };
    } catch (error) {
      logger.error('Error fetching notification history', {
        employeeId,
        organizationId,
        options,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getNotificationByTransaction(
    transactionId: number,
    organizationId: number
  ): Promise<NotificationRecord[]> {
    try {
      const result = await query(
        `SELECT 
          id,
          transaction_id,
          employee_id,
          organization_id,
          notification_type,
          status,
          message_id,
          error_message,
          sent_at,
          created_at
        FROM notifications
        WHERE transaction_id = $1 AND organization_id = $2
        ORDER BY created_at DESC`,
        [transactionId, organizationId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        transactionId: row.transaction_id,
        employeeId: row.employee_id,
        organizationId: row.organization_id,
        notificationType: row.notification_type,
        status: row.status,
        messageId: row.message_id,
        errorMessage: row.error_message,
        sentAt: row.sent_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error fetching notifications by transaction', {
        transactionId,
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
