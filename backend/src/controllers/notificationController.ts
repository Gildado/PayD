import { Request, Response } from 'express';
import { NotificationTrackingService } from '../services/notificationTrackingService.js';
import { NotificationConfigService } from '../services/notificationConfigService.js';
import { PushNotificationService } from '../services/pushNotificationService.js';
import { NotificationService } from '../services/notificationService.js';
import { JWTPayload } from '../types/auth.js';
import logger from '../utils/logger.js';

const trackingService = new NotificationTrackingService();
const configService = new NotificationConfigService();
const pushService = new PushNotificationService();
const notificationService = new NotificationService();

type NotificationUser = JWTPayload & { employeeId?: number; role: JWTPayload['role'] | 'admin' };

const getUser = (req: Request): NotificationUser => req.user as NotificationUser;

const isOrganizationAdmin = (user: NotificationUser) =>
  user.role === 'EMPLOYER' || user.role === 'admin';

export const getNotificationHistory = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const employeeId = parseInt(req.query.employee_id as string) || user.employeeId;
    const organizationId = user.organizationId;
    const transactionId = req.query.transaction_id
      ? parseInt(req.query.transaction_id as string)
      : undefined;

    // Authorization check: users can only view their own history unless they're admin
    if (employeeId !== user.employeeId && !isOrganizationAdmin(user)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own notification history',
      });
    }

    // If transaction_id is provided, get notifications for that transaction
    if (transactionId) {
      const notifications = await trackingService.getNotificationByTransaction(
        transactionId,
        organizationId
      );
      return res.json({ data: notifications });
    }

    // Otherwise, get paginated history. Clamp pagination to bound the query
    // size and avoid unbounded scans / divide-by-zero on totalPages.
    const MAX_LIMIT = 100;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), MAX_LIMIT);
    const notificationType = req.query.notification_type as 'email' | 'push' | undefined;
    const status = req.query.status as 'sent' | 'failed' | 'pending' | undefined;

    const result = await trackingService.getNotificationHistory(
      employeeId,
      organizationId,
      {
        notificationType,
        status,
        page,
        limit,
      }
    );

    res.json({
      data: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching notification history', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch notification history',
    });
  }
};

export const getNotificationConfig = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    // Only admins can view notification config
    if (!isOrganizationAdmin(user)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can view notification configuration',
      });
    }

    const config = await configService.getConfig(user.organizationId);
    res.json(config);
  } catch (error) {
    logger.error('Error fetching notification config', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch notification configuration',
    });
  }
};

export const updateNotificationConfig = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    // Only admins can update notification config
    if (!isOrganizationAdmin(user)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can update notification configuration',
      });
    }

    const {
      emailEnabled,
      pushEnabled,
      emailProvider,
      fromEmail,
      fromName,
      locale,
    } = req.body;

    // Validate input
    if (emailProvider && !['resend', 'sendgrid'].includes(emailProvider)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email provider. Must be "resend" or "sendgrid"',
      });
    }

    await configService.updateConfig(user.organizationId, {
      emailEnabled,
      pushEnabled,
      emailProvider,
      fromEmail,
      fromName,
      locale,
    });

    const updatedConfig = await configService.getConfig(user.organizationId);
    res.json(updatedConfig);
  } catch (error) {
    logger.error('Error updating notification config', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update notification configuration',
    });
  }
};

export const registerPushToken = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { token, platform } = req.body;

    // Validate input
    if (!token || !platform) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token and platform are required',
      });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid platform. Must be "ios", "android", or "web"',
      });
    }

    await pushService.registerToken(user.employeeId, token, platform);

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    logger.error('Error registering push token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register push token',
    });
  }
};

export const removePushToken = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { token } = req.body;

    // Validate input
    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token is required',
      });
    }

    await pushService.removeToken(user.employeeId, token);

    res.json({
      success: true,
      message: 'Push token removed successfully',
    });
  } catch (error) {
    logger.error('Error removing push token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove push token',
    });
  }
};

export const sendPaymentNotification = async (req: Request, res: Response) => {
  try {
    const user = getUser(req);

    if (!isOrganizationAdmin(user)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only organization administrators can send payment notifications',
      });
    }

    if (!user.organizationId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User is not associated with an organization',
      });
    }

    const {
      employeeId,
      transactionId,
      transactionHash,
      amount,
      assetCode,
      timestamp,
    } = req.body;

    if (!employeeId || !transactionId || !transactionHash || !amount || !assetCode) {
      return res.status(400).json({
        error: 'Bad Request',
        message:
          'employeeId, transactionId, transactionHash, amount, and assetCode are required',
      });
    }

    const result = await notificationService.sendPaymentNotification({
      organizationId: user.organizationId,
      employeeId: Number(employeeId),
      transactionId: Number(transactionId),
      transactionHash: String(transactionHash),
      amount: String(amount),
      assetCode: String(assetCode).toUpperCase(),
      timestamp: timestamp ? String(timestamp) : new Date().toISOString(),
    });

    res.status(202).json({
      success: result.email.success || result.push.success,
      data: result,
    });
  } catch (error) {
    logger.error('Error sending payment notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to send payment notification',
    });
  }
};
