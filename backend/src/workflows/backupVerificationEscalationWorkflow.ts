import { z } from 'zod';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';
import { withSpan } from '../utils/tracing.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';

export const BACKUP_FAILURE_STAGES = [
  'file_discovery',
  'database_creation',
  'restore_execution',
  'table_count_check',
  'constraint_check',
  'data_integrity_check',
  'cleanup',
  'unknown',
] as const;
export type BackupFailureStage = (typeof BACKUP_FAILURE_STAGES)[number];

export const ESCALATION_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type EscalationSeverity = (typeof ESCALATION_SEVERITIES)[number];

export const backupVerificationEscalationSchema = z
  .object({
    backupFile: z.string().trim().min(1).max(500),
    failureStage: z.enum(BACKUP_FAILURE_STAGES),
    errorMessage: z.string().trim().min(1),
    severity: z.enum(ESCALATION_SEVERITIES).optional(),
    testDatabase: z.string().trim().optional(),
    durationSeconds: z.number().nonnegative().optional(),
    details: z.record(z.unknown()).optional(),
  })
  .strict();

export interface BackupEscalationOutcome {
  status: 'escalated' | 'quarantined' | 'investigation_logged';
  incidentId: string;
  backupFile: string;
  failureStage: BackupFailureStage;
  severity: EscalationSeverity;
  escalationChannel: 'pagerduty' | 'slack_alerts' | 'ops_email';
  notificationSent: boolean;
  quarantined: boolean;
  escalatedAt: string;
  summary: string;
}

export interface BackupNotificationClient {
  sendEscalationAlert(
    channel: string,
    payload: {
      incidentId: string;
      backupFile: string;
      severity: EscalationSeverity;
      failureStage: BackupFailureStage;
      errorMessage: string;
    }
  ): Promise<{ sent: boolean }>;
}

export class BackupVerificationEscalationWorkflow {
  constructor(
    private readonly db = pool,
    private readonly notificationClient?: BackupNotificationClient,
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof backupVerificationEscalationSchema>
  ) {
    const run = new WorkflowRun('backup-verification-escalation', context, this.delayMs);
    return run.execute<BackupEscalationOutcome>(async () => {
      // Escalation operations require employer / admin privileges
      requireOrganization(context, true);
      input = backupVerificationEscalationSchema.parse(input);

      // Step 1: Assess failure severity based on stage and error details
      const assessment = await run.step('assess-failure-severity', async () => {
        let calculatedSeverity: EscalationSeverity;

        if (input.severity) {
          calculatedSeverity = input.severity;
        } else if (
          input.failureStage === 'restore_execution' ||
          input.failureStage === 'data_integrity_check' ||
          input.failureStage === 'table_count_check'
        ) {
          calculatedSeverity = 'critical';
        } else if (
          input.failureStage === 'constraint_check' ||
          input.failureStage === 'file_discovery'
        ) {
          calculatedSeverity = 'high';
        } else {
          calculatedSeverity = 'medium';
        }

        const shouldQuarantine =
          calculatedSeverity === 'critical' || calculatedSeverity === 'high';

        const escalationChannel =
          calculatedSeverity === 'critical'
            ? 'pagerduty'
            : calculatedSeverity === 'high'
              ? 'slack_alerts'
              : 'ops_email';

        logger.warn('Backup verification failure severity assessed', {
          backupFile: input.backupFile,
          failureStage: input.failureStage,
          severity: calculatedSeverity,
          channel: escalationChannel,
          executionId: run.executionId,
        });

        return {
          severity: calculatedSeverity,
          shouldQuarantine,
          escalationChannel,
        };
      });

      // Step 2: Quarantine corrupted backup artifact if severe
      const quarantineResult = await run.step(
        'quarantine-backup-artifact',
        async () => {
          if (!assessment.shouldQuarantine) {
            return { quarantined: false };
          }

          // Mark backup status in database to prevent dangerous restore operations
          await this.db.query(
            `INSERT INTO backup_verification_logs (
              backup_file,
              backup_size,
              test_database,
              success,
              checks,
              duration_seconds,
              error,
              created_at
            ) VALUES ($1, $2, $3, false, $4, $5, $6, NOW())`,
            [
              input.backupFile,
              0,
              input.testDatabase || 'none',
              JSON.stringify({ quarantined: true, failureStage: input.failureStage }),
              input.durationSeconds || 0,
              `[QUARANTINED - ${assessment.severity.toUpperCase()}] ${input.errorMessage}`,
            ]
          );

          logger.info('Backup marked as quarantined', {
            backupFile: input.backupFile,
            executionId: run.executionId,
          });

          return { quarantined: true };
        },
        true // safe to retry transient database errors
      );

      // Step 3: Dispatch escalation alert to on-call or ops channel
      const alertResult = await run.step(
        'dispatch-escalation-alert',
        async () => {
          if (this.notificationClient) {
            await this.notificationClient.sendEscalationAlert(
              assessment.escalationChannel,
              {
                incidentId: run.executionId,
                backupFile: input.backupFile,
                severity: assessment.severity,
                failureStage: input.failureStage,
                errorMessage: input.errorMessage,
              }
            );
          } else {
            logger.error('CRITICAL OPS ALERT: Backup verification failure', {
              incidentId: run.executionId,
              backupFile: input.backupFile,
              severity: assessment.severity,
              failureStage: input.failureStage,
              error: input.errorMessage,
              channel: assessment.escalationChannel,
            });
          }

          return { dispatched: true };
        },
        true // safe to retry transient notification network errors
      );

      // Step 4: Record incident audit log
      await run.step(
        'record-incident-audit',
        async () => {
          logger.info('Backup verification escalation workflow completed and audited', {
            incidentId: run.executionId,
            backupFile: input.backupFile,
            severity: assessment.severity,
          });
          return { recorded: true };
        },
        true
      );

      return {
        status: quarantineResult.quarantined ? 'quarantined' : 'escalated',
        incidentId: run.executionId,
        backupFile: input.backupFile,
        failureStage: input.failureStage,
        severity: assessment.severity,
        escalationChannel: assessment.escalationChannel,
        notificationSent: alertResult.dispatched,
        quarantined: quarantineResult.quarantined,
        escalatedAt: new Date().toISOString(),
        summary: `Backup verification failed at stage "${input.failureStage}": ${input.errorMessage}. Severity: ${assessment.severity}.`,
      };
    });
  }
}
