/**
 * Email Delivery Webhook Routes (#1050)
 * 
 * Handles webhook events from email providers (SendGrid/Resend)
 * for delivery tracking, bounces, opens, and clicks.
 */

import express, { Request, Response } from 'express';
import logger from '../utils/logger.js';
import {
  emailDeliveryTracking,
  EmailDeliveryStatus,
  BounceType,
} from '../services/emailDeliveryTrackingService.js';

const router = express.Router();

/**
 * SendGrid webhook endpoint
 * POST /webhooks/sendgrid/email-events
 */
router.post('/sendgrid/email-events', async (req: Request, res: Response) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    logger.info('Received SendGrid webhook events', { eventCount: events.length });

    for (const event of events) {
      const messageId = event.sg_message_id || event['smtp-id'];
      const email = event.email;
      const eventType = event.event;

      // Map SendGrid event types to our status enum
      let status: EmailDeliveryStatus;
      let bounceType: BounceType | undefined;
      let bounceReason: string | undefined;

      switch (eventType) {
        case 'delivered':
          status = EmailDeliveryStatus.DELIVERED;
          break;
        case 'open':
          status = EmailDeliveryStatus.OPENED;
          break;
        case 'click':
          status = EmailDeliveryStatus.CLICKED;
          break;
        case 'bounce':
          status = EmailDeliveryStatus.BOUNCED;
          bounceType = event.type === 'blocked' ? BounceType.HARD : BounceType.SOFT;
          bounceReason = event.reason;
          break;
        case 'dropped':
        case 'deferred':
          status = EmailDeliveryStatus.FAILED;
          bounceType = BounceType.SOFT;
          bounceReason = event.reason;
          break;
        default:
          logger.warn('Unknown SendGrid event type', { eventType, messageId });
          continue;
      }

      await emailDeliveryTracking.processDeliveryEvent({
        messageId,
        email,
        status,
        provider: 'sendgrid',
        bounceType,
        bounceReason,
        timestamp: new Date(event.timestamp * 1000),
        metadata: {
          sendgrid_event: eventType,
          ip: event.ip,
          user_agent: event.useragent,
        },
      });
    }

    res.status(200).json({ received: events.length });
  } catch (error) {
    logger.error('Failed to process SendGrid webhook', { error });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Resend webhook endpoint
 * POST /webhooks/resend/email-events
 */
router.post('/resend/email-events', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    logger.info('Received Resend webhook event', { eventType: event.type });

    const messageId = event.data?.email_id || event.data?.id;
    const email = event.data?.to?.[0] || event.data?.email;
    const eventType = event.type;

    let status: EmailDeliveryStatus;
    let bounceType: BounceType | undefined;
    let bounceReason: string | undefined;

    switch (eventType) {
      case 'email.delivered':
        status = EmailDeliveryStatus.DELIVERED;
        break;
      case 'email.opened':
        status = EmailDeliveryStatus.OPENED;
        break;
      case 'email.clicked':
        status = EmailDeliveryStatus.CLICKED;
        break;
      case 'email.bounced':
        status = EmailDeliveryStatus.BOUNCED;
        bounceType = event.data?.bounce_type === 'Hard' ? BounceType.HARD : BounceType.SOFT;
        bounceReason = event.data?.bounce_reason;
        break;
      case 'email.complaint':
        status = EmailDeliveryStatus.FAILED;
        bounceReason = 'Spam complaint';
        break;
      default:
        logger.warn('Unknown Resend event type', { eventType, messageId });
        return res.status(200).json({ received: true });
    }

    await emailDeliveryTracking.processDeliveryEvent({
      messageId,
      email,
      status,
      provider: 'resend',
      bounceType,
      bounceReason,
      timestamp: new Date(event.created_at),
      metadata: {
        resend_event: eventType,
      },
    });

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Failed to process Resend webhook', { error });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Admin endpoint to view email delivery status by message ID / notification ID
 * GET /webhooks/delivery-status/:messageId
 */
router.get('/delivery-status/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const status = await emailDeliveryTracking.getDeliveryStatusByMessageId(messageId);
    if (!status) {
      return res.status(404).json({ error: 'Notification delivery status not found' });
    }
    res.status(200).json(status);
  } catch (error) {
    logger.error('Failed to get delivery status by message ID', { error });
    res.status(500).json({ error: 'Failed to get delivery status' });
  }
});

/**
 * Admin endpoint to view email delivery statistics
 * GET /webhooks/email-stats
 */
router.get('/email-stats', async (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as 'sendgrid' | 'resend' | undefined;

    const stats = await emailDeliveryTracking.getDeliveryStats(provider);

    res.status(200).json(stats);
  } catch (error) {
    logger.error('Failed to get email stats', { error });
    res.status(500).json({ error: 'Failed to get email stats' });
  }
});

/**
 * Admin endpoint to view email activity for specific email address
 * GET /webhooks/email-activity/:email
 */
router.get('/email-activity/:email', async (req: Request, res: Response) => {
  try {
    const email = req.params.email;
    const limit = parseInt(req.query.limit as string) || 50;

    const activity = await emailDeliveryTracking.getEmailActivity(email, limit);

    res.status(200).json({
      email,
      activity,
      count: activity.length,
    });
  } catch (error) {
    logger.error('Failed to get email activity', { error });
    res.status(500).json({ error: 'Failed to get email activity' });
  }
});

export default router;
