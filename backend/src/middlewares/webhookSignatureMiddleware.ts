/**
 * Webhook Signature Verification Middleware
 * 
 * Verifies webhook signatures from email providers (SendGrid, Resend)
 * with timestamp tolerance to prevent replay attacks.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';
import { pool } from '../config/database.js';

/**
 * Maximum age of webhook timestamp in seconds (5 minutes)
 * Prevents replay attacks with old valid signatures
 */
const MAX_TIMESTAMP_AGE_SECONDS = 5 * 60;

/**
 * In-memory set to track recently processed event IDs
 * Size limited to last 10,000 events (roughly 1-2 hours at high volume)
 */
const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENT_IDS = 10000;

/**
 * Track processed event IDs with LRU eviction
 */
function markEventProcessed(eventId: string): void {
  if (processedEventIds.size >= MAX_PROCESSED_EVENT_IDS) {
    // Remove oldest entry (first in Set)
    const firstKey = processedEventIds.values().next().value;
    processedEventIds.delete(firstKey);
  }
  processedEventIds.add(eventId);
}

/**
 * Check if event has been processed recently
 */
function isEventProcessed(eventId: string): boolean {
  return processedEventIds.has(eventId);
}

/**
 * Verify SendGrid webhook signature
 * Uses ECDSA signature verification with public key
 */
function verifySendGridSignature(req: Request): boolean {
  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
  
  if (!signature || !timestamp) {
    logger.warn('SendGrid webhook missing signature or timestamp headers');
    return false;
  }

  // Check timestamp to prevent replay attacks
  const webhookTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  if (Math.abs(currentTimestamp - webhookTimestamp) > MAX_TIMESTAMP_AGE_SECONDS) {
    logger.warn('SendGrid webhook timestamp outside tolerance window', {
      webhookTimestamp,
      currentTimestamp,
      ageDifference: Math.abs(currentTimestamp - webhookTimestamp),
    });
    return false;
  }

  const publicKey = config.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) {
    logger.error('SENDGRID_WEBHOOK_PUBLIC_KEY not configured');
    return false;
  }

  try {
    // SendGrid uses ECDSA signature
    const verifier = crypto.createVerify('sha256');
    verifier.update(timestamp + req.rawBody);
    
    return verifier.verify(
      publicKey,
      signature,
      'base64'
    );
  } catch (error) {
    logger.error('Error verifying SendGrid signature', { error });
    return false;
  }
}

/**
 * Verify Resend webhook signature
 * Uses HMAC-SHA256 with secret key
 */
function verifyResendSignature(req: Request): boolean {
  const signature = req.headers['svix-signature'] as string;
  const timestamp = req.headers['svix-timestamp'] as string;
  const webhookId = req.headers['svix-id'] as string;
  
  if (!signature || !timestamp || !webhookId) {
    logger.warn('Resend webhook missing required svix headers');
    return false;
  }

  // Check timestamp to prevent replay attacks
  const webhookTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  if (Math.abs(currentTimestamp - webhookTimestamp) > MAX_TIMESTAMP_AGE_SECONDS) {
    logger.warn('Resend webhook timestamp outside tolerance window', {
      webhookTimestamp,
      currentTimestamp,
      ageDifference: Math.abs(currentTimestamp - webhookTimestamp),
    });
    return false;
  }

  const secret = config.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('RESEND_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    // Resend/Svix uses HMAC-SHA256
    const signedContent = `${webhookId}.${timestamp}.${req.rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('base64');

    // Extract the signature from the header (format: "v1,signature")
    const signatureParts = signature.split(',');
    const actualSignature = signatureParts.find(s => s.startsWith('v1,'))?.substring(3);
    
    if (!actualSignature) {
      logger.warn('Could not extract v1 signature from Resend webhook');
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(actualSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error verifying Resend signature', { error });
    return false;
  }
}

/**
 * Middleware for SendGrid webhook signature verification
 */
export const verifySendGridWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip verification in development if explicitly disabled
  if (config.NODE_ENV === 'development' && config.SKIP_WEBHOOK_VERIFICATION === 'true') {
    logger.warn('SendGrid webhook signature verification SKIPPED (development mode)');
    return next();
  }

  if (!verifySendGridSignature(req)) {
    logger.warn('SendGrid webhook signature verification failed', {
      path: req.path,
      ip: req.ip,
    });

    return res.status(401).json(
      apiErrorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Invalid webhook signature'
      )
    );
  }

  // Check for replay attack using event IDs
  const events = Array.isArray(req.body) ? req.body : [req.body];
  
  for (const event of events) {
    const eventId = event.sg_event_id || event.sg_message_id;
    
    if (eventId && isEventProcessed(eventId)) {
      logger.warn('SendGrid webhook replay attack detected', {
        eventId,
        path: req.path,
      });

      return res.status(409).json(
        apiErrorResponse(
          ErrorCodes.CONFLICT,
          'Webhook event already processed (replay detected)'
        )
      );
    }

    if (eventId) {
      markEventProcessed(eventId);
      
      // Also store in database for long-term replay prevention
      try {
        await pool.query(
          'INSERT INTO webhook_event_ids (event_id, provider, received_at) VALUES ($1, $2, NOW()) ON CONFLICT (event_id) DO NOTHING',
          [eventId, 'sendgrid']
        );
      } catch (error) {
        logger.error('Failed to store webhook event ID', { error, eventId });
        // Don't fail the webhook, just log the error
      }
    }
  }

  logger.debug('SendGrid webhook signature verified successfully');
  next();
};

/**
 * Middleware for Resend webhook signature verification
 */
export const verifyResendWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip verification in development if explicitly disabled
  if (config.NODE_ENV === 'development' && config.SKIP_WEBHOOK_VERIFICATION === 'true') {
    logger.warn('Resend webhook signature verification SKIPPED (development mode)');
    return next();
  }

  if (!verifyResendSignature(req)) {
    logger.warn('Resend webhook signature verification failed', {
      path: req.path,
      ip: req.ip,
    });

    return res.status(401).json(
      apiErrorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Invalid webhook signature'
      )
    );
  }

  // Check for replay attack using webhook ID
  const webhookId = req.headers['svix-id'] as string;
  
  if (webhookId && isEventProcessed(webhookId)) {
    logger.warn('Resend webhook replay attack detected', {
      webhookId,
      path: req.path,
    });

    return res.status(409).json(
      apiErrorResponse(
        ErrorCodes.CONFLICT,
        'Webhook event already processed (replay detected)'
      )
    );
  }

  if (webhookId) {
    markEventProcessed(webhookId);
    
    // Also store in database for long-term replay prevention
    try {
      await pool.query(
        'INSERT INTO webhook_event_ids (event_id, provider, received_at) VALUES ($1, $2, NOW()) ON CONFLICT (event_id) DO NOTHING',
        [webhookId, 'resend']
      );
    } catch (error) {
      logger.error('Failed to store webhook event ID', { error, webhookId });
      // Don't fail the webhook, just log the error
    }
  }

  logger.debug('Resend webhook signature verified successfully');
  next();
};
