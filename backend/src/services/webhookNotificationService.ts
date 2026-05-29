import { pool } from '../config/database.js';
import CryptoJS from 'crypto-js';
import axios, { AxiosError } from 'axios';
import logger from '../utils/logger.js';

export type WebhookEventType =
  | 'payroll.completed'
  | 'payroll.failed'
  | 'payroll.started'
  | 'employee.added'
  | 'employee.updated'
  | 'employee.removed'
  | 'employee.deleted'
  | 'balance.low'
  | 'transaction.completed'
  | 'transaction.failed'
  | 'contract.upgraded'
  | 'multisig.created'
  | 'multisig.executed'
  | 'payment.completed'
  | 'payment.failed'
  | 'claimable_balance.created'
  | 'claimable_balance.claimed';

export const WEBHOOK_EVENTS = {
  PAYROLL_COMPLETED: 'payroll.completed',
  PAYROLL_FAILED: 'payroll.failed',
  PAYROLL_STARTED: 'payroll.started',
  EMPLOYEE_ADDED: 'employee.added',
  EMPLOYEE_UPDATED: 'employee.updated',
  EMPLOYEE_REMOVED: 'employee.removed',
  EMPLOYEE_DELETED: 'employee.deleted',
  BALANCE_LOW: 'balance.low',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',
  CONTRACT_UPGRADED: 'contract.upgraded',
  MULTISIG_CREATED: 'multisig.created',
  MULTISIG_EXECUTED: 'multisig.executed',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  CLAIMABLE_BALANCE_CREATED: 'claimable_balance.created',
  CLAIMABLE_BALANCE_CLAIMED: 'claimable_balance.claimed',
} as const;

export interface WebhookSubscription {
  id: number;
  organizationId: number;
  url: string;
  secretHash: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  organizationId: number;
  url: string;
  secret: string;
  events: string[];
  description?: string;
}

export interface UpdateSubscriptionInput {
  url?: string;
  events?: string[];
  isActive?: boolean;
  description?: string;
}

export interface WebhookDeliveryLog {
  id: number;
  subscriptionId: number;
  eventType: string;
  payload: Record<string, any>;
  requestHeaders: Record<string, string>;
  responseStatusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  attemptNumber: number;
  deliveredAt: Date | null;
  nextRetryAt: Date | null;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  createdAt: Date;
}

export interface WebhookPayload {
  id: string;
  eventType: string;
  timestamp: string;
  data: Record<string, any>;
  organizationId: number;
}

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 60000;
const TIMEOUT_MS = 10000;

function calculateBackoffDelay(attemptNumber: number): number {
  const delay = Math.min(INITIAL_DELAY_MS * Math.pow(2, attemptNumber - 1), MAX_DELAY_MS);
  return delay + Math.random() * 1000;
}

function hashSecret(secret: string): string {
  return CryptoJS.SHA256(secret).toString(CryptoJS.enc.Hex);
}

function generateHMACSignature(payload: string, secret: string, timestamp: string): string {
  const message = `${timestamp}.${payload}`;
  return CryptoJS.HmacSHA256(message, secret).toString(CryptoJS.enc.Hex);
}

/**
 * Validates webhook secret format and strength
 * Issue #694: Enhanced secret validation
 */
function validateWebhookSecret(secret: string): { valid: boolean; error?: string } {
  if (!secret || typeof secret !== 'string') {
    return { valid: false, error: 'Secret is required and must be a string' };
  }

  if (secret.length < 32) {
    return { valid: false, error: 'Secret must be at least 32 characters long' };
  }

  if (secret.length > 256) {
    return { valid: false, error: 'Secret must not exceed 256 characters' };
  }

  // Check for sufficient entropy (at least some variety in characters)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 16) {
    return { valid: false, error: 'Secret must contain at least 16 unique characters for security' };
  }

  // Warn if secret looks like a common pattern
  const commonPatterns = [
    /^(.)\1+$/, // All same character
    /^(0123456789)+/, // Sequential numbers
    /^(abcdefghij)+/i, // Sequential letters
    /^(password|secret|webhook)/i, // Common words
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(secret)) {
      return { valid: false, error: 'Secret appears to use a weak or common pattern' };
    }
  }

  return { valid: true };
}

/**
 * Verifies HMAC signature from incoming webhook requests
 * Issue #694: Signature verification for webhook endpoints
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceSeconds: number = 300
): { valid: boolean; error?: string } {
  // Validate timestamp to prevent replay attacks
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);

  if (isNaN(requestTime)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  const timeDiff = Math.abs(now - requestTime);
  if (timeDiff > toleranceSeconds * 1000) {
    return { valid: false, error: 'Request timestamp is outside tolerance window (possible replay attack)' };
  }

  // Generate expected signature
  const expectedSignature = generateHMACSignature(payload, secret, timestamp);

  // Timing-safe comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: 'Invalid signature format' };
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { valid: false, error: 'Signature verification failed' };
  }

  return { valid: true };
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export class WebhookNotificationService {
  static async createSubscription(input: CreateSubscriptionInput): Promise<WebhookSubscription> {
    // Issue #694: Validate secret before creating subscription
    const secretValidation = validateWebhookSecret(input.secret);
    if (!secretValidation.valid) {
      throw new Error(`Invalid webhook secret: ${secretValidation.error}`);
    }

    // Validate URL format
    try {
      const url = new URL(input.url);
      if (url.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS protocol');
      }
    } catch (error) {
      throw new Error('Invalid webhook URL format');
    }

    const secretHash = hashSecret(input.secret);

    const result = await pool.query(
      `INSERT INTO webhook_subscriptions (organization_id, url, secret_hash, events, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.organizationId, input.url, secretHash, input.events, input.description || null]
    );

    logger.info('Webhook subscription created', {
      subscriptionId: result.rows[0].id,
      organizationId: input.organizationId,
      events: input.events,
    });

    return result.rows[0];
  }

  static async getSubscriptions(organizationId: number): Promise<WebhookSubscription[]> {
    const result = await pool.query(
      `SELECT * FROM webhook_subscriptions WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    return result.rows;
  }

  static async getSubscriptionById(
    id: number,
    organizationId: number
  ): Promise<WebhookSubscription | null> {
    const result = await pool.query(
      `SELECT * FROM webhook_subscriptions WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async updateSubscription(
    id: number,
    organizationId: number,
    input: UpdateSubscriptionInput
  ): Promise<WebhookSubscription | null> {
    const updates: string[] = [];
    const values: (string | boolean | string[] | number)[] = [];
    let paramIdx = 1;

    if (input.url !== undefined) {
      updates.push(`url = $${paramIdx++}`);
      values.push(input.url);
    }
    if (input.events !== undefined) {
      updates.push(`events = $${paramIdx++}`);
      values.push(input.events);
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIdx++}`);
      values.push(input.isActive);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(input.description);
    }

    if (updates.length === 0) {
      return this.getSubscriptionById(id, organizationId);
    }

    values.push(id, organizationId);
    const result = await pool.query(
      `UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = $${paramIdx} AND organization_id = $${paramIdx + 1} RETURNING *`,
      values
    );

    if (result.rows[0]) {
      logger.info('Webhook subscription updated', { subscriptionId: id, organizationId });
    }

    return result.rows[0] || null;
  }

  static async deleteSubscription(id: number, organizationId: number): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM webhook_subscriptions WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if (result.rowCount && result.rowCount > 0) {
      logger.info('Webhook subscription deleted', { subscriptionId: id, organizationId });
      return true;
    }
    return false;
  }

  static async getEventTypes(): Promise<{ name: string; description: string; category: string }[]> {
    const result = await pool.query(
      `SELECT name, description, category FROM webhook_event_types ORDER BY category, name`
    );
    return result.rows;
  }

  static async createDeliveryLog(
    subscriptionId: number,
    eventType: string,
    payload: Record<string, any>,
    requestHeaders: Record<string, string>
  ): Promise<WebhookDeliveryLog> {
    const result = await pool.query(
      `INSERT INTO webhook_delivery_logs (subscription_id, event_type, payload, request_headers, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [subscriptionId, eventType, JSON.stringify(payload), JSON.stringify(requestHeaders)]
    );
    return result.rows[0];
  }

  static async updateDeliveryLog(
    id: number,
    updates: {
      responseStatusCode?: number;
      responseBody?: string;
      errorMessage?: string;
      attemptNumber?: number;
      deliveredAt?: Date;
      nextRetryAt?: Date;
      status: 'pending' | 'success' | 'failed' | 'retrying';
    }
  ): Promise<WebhookDeliveryLog | null> {
    const setClauses: string[] = [];
    const values: (number | string | Date | null)[] = [];
    let paramIdx = 1;

    if (updates.responseStatusCode !== undefined) {
      setClauses.push(`response_status_code = $${paramIdx++}`);
      values.push(updates.responseStatusCode);
    }
    if (updates.responseBody !== undefined) {
      setClauses.push(`response_body = $${paramIdx++}`);
      values.push(updates.responseBody);
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIdx++}`);
      values.push(updates.errorMessage);
    }
    if (updates.attemptNumber !== undefined) {
      setClauses.push(`attempt_number = $${paramIdx++}`);
      values.push(updates.attemptNumber);
    }
    if (updates.deliveredAt !== undefined) {
      setClauses.push(`delivered_at = $${paramIdx++}`);
      values.push(updates.deliveredAt);
    }
    if (updates.nextRetryAt !== undefined) {
      setClauses.push(`next_retry_at = $${paramIdx++}`);
      values.push(updates.nextRetryAt);
    }
    setClauses.push(`status = $${paramIdx++}`);
    values.push(updates.status);

    values.push(id);
    const result = await pool.query(
      `UPDATE webhook_delivery_logs SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async getDeliveryLogs(
    organizationId: number,
    options: {
      subscriptionId?: number;
      status?: 'pending' | 'success' | 'failed' | 'retrying';
      eventType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: WebhookDeliveryLog[]; total: number }> {
    const conditions: string[] = ['ws.organization_id = $1'];
    const values: (number | string)[] = [organizationId];
    let paramIdx = 2;

    if (options.subscriptionId) {
      conditions.push(`wdl.subscription_id = $${paramIdx++}`);
      values.push(options.subscriptionId);
    }
    if (options.status) {
      conditions.push(`wdl.status = $${paramIdx++}`);
      values.push(options.status);
    }
    if (options.eventType) {
      conditions.push(`wdl.event_type = $${paramIdx++}`);
      values.push(options.eventType);
    }

    const whereClause = conditions.join(' AND ');
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM webhook_delivery_logs wdl
       JOIN webhook_subscriptions ws ON wdl.subscription_id = ws.id
       WHERE ${whereClause}`,
      values
    );

    const dataResult = await pool.query(
      `SELECT wdl.* FROM webhook_delivery_logs wdl
       JOIN webhook_subscriptions ws ON wdl.subscription_id = ws.id
       WHERE ${whereClause}
       ORDER BY wdl.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...values, limit, offset]
    );

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  static async dispatch(
    eventType: WebhookEventType | string,
    data: Record<string, any>,
    organizationId: number,
    secret?: string
  ): Promise<void> {
    const result = await pool.query(
      `SELECT * FROM webhook_subscriptions
       WHERE organization_id = $1 AND is_active = true
       AND (events @> ARRAY[$2] OR events @> ARRAY['*'])`,
      [organizationId, eventType]
    );

    const subscriptions = result.rows;

    if (subscriptions.length === 0) {
      logger.debug('No active subscriptions for event', { eventType, organizationId });
      return;
    }

    const payload: WebhookPayload = {
      id: generateEventId(),
      eventType,
      timestamp: new Date().toISOString(),
      data,
      organizationId,
    };

    const dispatchPromises = subscriptions.map((sub) =>
      this.dispatchToSubscription(sub, payload, secret)
    );

    await Promise.allSettled(dispatchPromises);
  }

  private static async dispatchToSubscription(
    subscription: WebhookSubscription,
    payload: WebhookPayload,
    secret?: string
  ): Promise<void> {
    const timestamp = Date.now().toString();
    const payloadString = JSON.stringify(payload);

    const signature = secret
      ? generateHMACSignature(payloadString, secret, timestamp)
      : generateHMACSignature(payloadString, subscription.secretHash, timestamp);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-PayD-Event': payload.eventType,
      'X-PayD-Signature': signature,
      'X-PayD-Timestamp': timestamp,
      'X-PayD-Delivery': payload.id,
    };

    const deliveryLog = await this.createDeliveryLog(
      subscription.id,
      payload.eventType,
      payload,
      headers
    );

    await this.sendWithRetry(subscription, payloadString, headers, deliveryLog.id);
  }

  private static async sendWithRetry(
    subscription: WebhookSubscription,
    payloadString: string,
    headers: Record<string, string>,
    deliveryLogId: number,
    attemptNumber: number = 1
  ): Promise<void> {
    try {
      const response = await axios.post(subscription.url, payloadString, {
        headers,
        timeout: TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 300,
      });

      await this.updateDeliveryLog(deliveryLogId, {
        responseStatusCode: response.status,
        responseBody:
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        deliveredAt: new Date(),
        status: 'success',
      });

      logger.info('Webhook delivered successfully', {
        subscriptionId: subscription.id,
        url: subscription.url,
        attemptNumber,
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.message || 'Unknown error';
      const statusCode = axiosError.response?.status;

      if (attemptNumber < MAX_RETRIES) {
        const nextRetryAt = new Date(Date.now() + calculateBackoffDelay(attemptNumber));

        await this.updateDeliveryLog(deliveryLogId, {
          responseStatusCode: statusCode,
          errorMessage,
          attemptNumber,
          nextRetryAt,
          status: 'retrying',
        });

        logger.warn('Webhook delivery failed, scheduling retry', {
          subscriptionId: subscription.id,
          attemptNumber,
          nextRetryAt,
          error: errorMessage,
        });

        await new Promise((resolve) => setTimeout(resolve, calculateBackoffDelay(attemptNumber)));
        await this.sendWithRetry(
          subscription,
          payloadString,
          headers,
          deliveryLogId,
          attemptNumber + 1
        );
      } else {
        await this.updateDeliveryLog(deliveryLogId, {
          responseStatusCode: statusCode,
          errorMessage: `Max retries exceeded: ${errorMessage}`,
          attemptNumber,
          status: 'failed',
        });

        logger.error('Webhook delivery failed after max retries', {
          subscriptionId: subscription.id,
          attemptNumber,
          error: errorMessage,
        });
      }
    }
  }

  static async processPendingRetries(): Promise<number> {
    const result = await pool.query(
      `SELECT wdl.*, ws.url, ws.secret_hash, ws.organization_id
       FROM webhook_delivery_logs wdl
       JOIN webhook_subscriptions ws ON wdl.subscription_id = ws.id
       WHERE wdl.status IN ('pending', 'retrying')
       AND wdl.next_retry_at <= CURRENT_TIMESTAMP
       LIMIT 100`
    );

    let processedCount = 0;

    for (const row of result.rows) {
      const subscription: WebhookSubscription = {
        id: row.subscription_id,
        organizationId: row.organization_id,
        url: row.url,
        secretHash: row.secret_hash,
        events: [],
        isActive: true,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const payload = row.payload;
      const payloadString = JSON.stringify(payload);
      const headers = row.request_headers;

      await this.sendWithRetry(
        subscription,
        payloadString,
        headers,
        row.id,
        row.attempt_number + 1
      );
      processedCount++;
    }

    if (processedCount > 0) {
      logger.info('Processed pending webhook retries', { count: processedCount });
    }

    return processedCount;
  }

  static async testEndpoint(
    url: string,
    secret: string,
    eventType: string = 'test.ping'
  ): Promise<{ success: boolean; statusCode?: number; error?: string; latencyMs?: number }> {
    const timestamp = Date.now().toString();
    const payload = {
      id: generateEventId(),
      eventType,
      timestamp: new Date().toISOString(),
      data: { test: true, message: 'This is a test webhook from PayD' },
      organizationId: 0,
    };
    const payloadString = JSON.stringify(payload);
    const signature = generateHMACSignature(payloadString, secret, timestamp);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-PayD-Event': eventType,
      'X-PayD-Signature': signature,
      'X-PayD-Timestamp': timestamp,
      'X-PayD-Delivery': payload.id,
    };

    const startTime = Date.now();

    try {
      const response = await axios.post(url, payloadString, {
        headers,
        timeout: TIMEOUT_MS,
      });

      return {
        success: true,
        statusCode: response.status,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        statusCode: axiosError.response?.status,
        error: axiosError.message,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  static async getDeliveryStats(organizationId: number): Promise<{
    total: number;
    successful: number;
    failed: number;
    pending: number;
    retrying: number;
  }> {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'success') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'retrying') as retrying
       FROM webhook_delivery_logs wdl
       JOIN webhook_subscriptions ws ON wdl.subscription_id = ws.id
       WHERE ws.organization_id = $1`,
      [organizationId]
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      successful: parseInt(row.successful, 10),
      failed: parseInt(row.failed, 10),
      pending: parseInt(row.pending, 10),
      retrying: parseInt(row.retrying, 10),
    };
  }
}

export const webhookNotificationService = WebhookNotificationService;
