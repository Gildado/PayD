import { pool } from '../config/database.js';
import axios from 'axios';

export const WEBHOOK_EVENTS = {
  PAYROLL_COMPLETED:         'payroll.completed',
  PAYROLL_FAILED:            'payroll.failed',
  PAYROLL_STARTED:           'payroll.started',
  EMPLOYEE_ADDED:            'employee.added',
  EMPLOYEE_UPDATED:          'employee.updated',
  EMPLOYEE_REMOVED:          'employee.removed',
  EMPLOYEE_DELETED:          'employee.deleted',
  BALANCE_LOW:               'balance.low',
  TRANSACTION_COMPLETED:     'transaction.completed',
  TRANSACTION_FAILED:        'transaction.failed',
  CONTRACT_UPGRADED:         'contract.upgraded',
  MULTISIG_CREATED:          'multisig.created',
  MULTISIG_EXECUTED:         'multisig.executed',
  PAYMENT_COMPLETED:         'payment.completed',
  PAYMENT_FAILED:            'payment.failed',
  CLAIMABLE_BALANCE_CREATED: 'claimable_balance.created',
  CLAIMABLE_BALANCE_CLAIMED: 'claimable_balance.claimed',
} as const;

const MAX_ATTEMPTS = 4;

function backoffMs(attempt: number): number {
  return 1000 * Math.pow(2, attempt - 1);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WebhookService {
  static async dispatch(
    eventType: string,
    organizationId: number,
    payload: object,
  ): Promise<void> {
    const result = await pool.query(
      `SELECT * FROM webhook_subscriptions
       WHERE organization_id = $1 AND is_active = true
         AND (events @> ARRAY[$2] OR events @> ARRAY['*'])`,
      [organizationId, eventType],
    );

    if (result.rows.length === 0) return;

    const payloadStr = JSON.stringify(payload);

    await Promise.allSettled(
      result.rows.map((sub) => this.deliverWithRetry(sub, eventType, payloadStr, 1)),
    );
  }

  private static async deliverWithRetry(
    subscription: { id: string | number; url: string },
    eventType: string,
    payloadStr: string,
    attempt: number,
  ): Promise<void> {
    try {
      await axios.post(subscription.url, payloadStr, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      await pool.query(
        `INSERT INTO webhook_delivery_logs
           (subscription_id, event_type, payload, response_status, response_body, error_message, attempt_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [subscription.id, eventType, payloadStr, null, null, null, attempt],
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await pool.query(
        `INSERT INTO webhook_delivery_logs
           (subscription_id, event_type, payload, response_status, response_body, error_message, attempt_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [subscription.id, eventType, payloadStr, null, null, errorMessage, attempt],
      );

      if (attempt < MAX_ATTEMPTS) {
        await wait(backoffMs(attempt));
        await this.deliverWithRetry(subscription, eventType, payloadStr, attempt + 1);
      }
    }
  }
}
