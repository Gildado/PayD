import { z } from 'zod';
import { pool } from '../config/database.js';
import { emailDeliveryTracking, EmailDeliveryTrackingService } from '../services/emailDeliveryTrackingService.js';
import logger from '../utils/logger.js';
import { withSpan } from '../utils/tracing.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';

export const emailDeliverabilityEscalationSchema = z
  .object({
    employeeId: z.number().int().positive(),
    email: z.string().email().optional(),
    failureThreshold: z.number().int().positive().default(3),
    forceEscalate: z.boolean().default(false),
    alternateChannel: z.enum(['sms', 'webhook', 'in_app', 'admin_alert']).optional(),
  })
  .strict();

export interface AlternateChannelResult {
  channel: 'sms' | 'webhook' | 'in_app' | 'admin_alert';
  destination?: string;
}

export interface EscalationOutcome {
  escalated: boolean;
  status: 'healthy' | 'escalated';
  employeeId: number;
  email: string;
  failureCount: number;
  alternateChannel?: string;
  destination?: string;
  escalatedAt?: string;
  message?: string;
}

export interface AlternateChannelNotifier {
  sendEscalationAlert(
    channel: string,
    destination: string | undefined,
    data: { employeeId: number; email: string; reason: string }
  ): Promise<{ delivered: boolean }>;
}

export class DefaultAlternateChannelNotifier implements AlternateChannelNotifier {
  async sendEscalationAlert(
    channel: string,
    destination: string | undefined,
    data: { employeeId: number; email: string; reason: string }
  ): Promise<{ delivered: boolean }> {
    logger.info('Dispatching escalation alert via alternate channel', {
      channel,
      destination,
      employeeId: data.employeeId,
    });
    return { delivered: true };
  }
}

export class EmailDeliverabilityEscalationWorkflow {
  constructor(
    private readonly deliveryTracking = emailDeliveryTracking,
    private readonly notifier: AlternateChannelNotifier = new DefaultAlternateChannelNotifier(),
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof emailDeliverabilityEscalationSchema>
  ) {
    const run = new WorkflowRun('email-deliverability-escalation', context, this.delayMs);
    return run.execute<EscalationOutcome>(async () => {
      const organizationId = requireOrganization(context);
      input = emailDeliverabilityEscalationSchema.parse(input);

      // Step 1: Resolve employee and check delivery history
      const { targetEmail, employee, failureCount, isInvalid } = await run.step(
        'check-delivery-status',
        async () => {
          const empResult = await pool.query<{
            id: number;
            organization_id: number;
            email: string | null;
            phone?: string | null;
            email_status?: string | null;
          }>(
            `SELECT id, organization_id, email, phone, email_status
             FROM employees
             WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
            [input.employeeId, organizationId]
          );

          const emp = empResult.rows[0];
          if (!emp) {
            throw new WorkflowError('NOT_FOUND', 'Employee not found in organization scope.', 404);
          }

          const emailToTest = input.email || emp.email;
          if (!emailToTest) {
            throw new WorkflowError('VALIDATION_ERROR', 'No email address found for employee.');
          }

          const isValid = await this.deliveryTracking.isEmailValid(emailToTest);
          const activity = await this.deliveryTracking.getEmailActivity(emailToTest, 50);

          let failures = 0;
          for (const item of activity) {
            if (
              item.status === 'bounced' ||
              item.status === 'failed' ||
              item.bounce_type === 'hard' ||
              (item.retry_count && item.retry_count >= 3)
            ) {
              failures++;
            }
          }

          return {
            targetEmail: emailToTest,
            employee: emp,
            failureCount: failures,
            isInvalid: !isValid || emp.email_status === 'invalid',
          };
        }
      );

      // Determine if escalation threshold is reached
      const shouldEscalate =
        input.forceEscalate ||
        isInvalid ||
        failureCount >= input.failureThreshold;

      if (!shouldEscalate) {
        return {
          escalated: false,
          status: 'healthy',
          employeeId: input.employeeId,
          email: targetEmail,
          failureCount,
          message: `Delivery health acceptable (${failureCount}/${input.failureThreshold} failures).`,
        };
      }

      // Step 2: Evaluate alternate contact channels
      const alternate = await run.step<AlternateChannelResult>(
        'evaluate-alternate-channels',
        async () => {
          if (input.alternateChannel) {
            return {
              channel: input.alternateChannel,
              destination: input.alternateChannel === 'sms' ? employee.phone || undefined : undefined,
            };
          }

          if (employee.phone && employee.phone.trim().length > 0) {
            return {
              channel: 'sms',
              destination: employee.phone.trim(),
            };
          }

          return {
            channel: 'admin_alert',
            destination: 'admin@payd.stellar',
          };
        }
      );

      // Step 3: Escalate deliverability failure and notify alternate channel
      return run.step(
        'escalate-failure',
        async () => {
          // Flag email invalid in database
          await pool.query(
            `UPDATE employees
             SET email_status = 'invalid',
                 email_invalid_reason = $1,
                 updated_at = NOW()
             WHERE id = $2 AND organization_id = $3`,
            [
              `Email deliverability failure escalated to alternate channel (${alternate.channel})`,
              input.employeeId,
              organizationId,
            ]
          );

          await pool.query(
            `INSERT INTO invalid_emails (email, reason, flagged_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (email) DO UPDATE SET reason = $2, flagged_at = NOW()`,
            [
              targetEmail,
              `Persistent delivery failures escalated to alternate channel (${alternate.channel})`,
            ]
          );

          // Dispatch notification to alternate channel (retried on transient errors)
          await this.notifier.sendEscalationAlert(alternate.channel, alternate.destination, {
            employeeId: input.employeeId,
            email: targetEmail,
            reason: `Email delivery failed ${failureCount} times. Escalated to ${alternate.channel}.`,
          });

          return {
            escalated: true,
            status: 'escalated' as const,
            employeeId: input.employeeId,
            email: targetEmail,
            failureCount,
            alternateChannel: alternate.channel,
            destination: alternate.destination,
            escalatedAt: new Date().toISOString(),
          };
        },
        true // safe to retry transient delivery failures
      );
    });
  }
}
