import { Router } from 'express';
import {
  getNotificationHistory,
  getNotificationConfig,
  updateNotificationConfig,
  registerPushToken,
  removePushToken,
  sendPaymentNotification,
} from '../controllers/notificationController.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = Router();

// All notification routes require authentication
router.use(authenticateJWT);

// Get notification history for an employee
router.get('/history', getNotificationHistory);

// Get notification configuration (admin only)
router.get('/config', getNotificationConfig);

// Update notification configuration (admin only)
router.put('/config', updateNotificationConfig);

// Send payment notification for a completed payroll transaction
router.post('/payment', sendPaymentNotification);

// Register a push notification token
router.post('/push-token', registerPushToken);

// Remove a push notification token
router.delete('/push-token', removePushToken);

export default router;
