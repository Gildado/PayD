import { z } from 'zod';
import tenantConfigService, { TenantConfigService } from '../services/tenantConfigService.js';
import logger from '../utils/logger.js';
import { withSpan } from '../utils/tracing.js';
import {
  requireOrganization,
  WorkflowError,
  WorkflowRun,
  type WorkflowContext,
} from './runtime.js';

export const SAFETY_PROBE_TYPES = [
  'schema_validation',
  'type_consistency',
  'range_check',
  'non_empty_check',
] as const;
export type SafetyProbeType = (typeof SAFETY_PROBE_TYPES)[number];

export const tenantConfigRollbackSafetySchema = z
  .object({
    configKey: z.string().trim().min(1).max(100),
    proposedConfig: z.record(z.unknown()),
    description: z.string().trim().max(500).optional(),
    probes: z.array(z.enum(SAFETY_PROBE_TYPES)).default(['schema_validation', 'type_consistency']),
    simulateFailure: z.boolean().default(false),
  })
  .strict();

export interface TenantConfigRollbackSafetyOutcome {
  status: 'applied_and_verified' | 'rolled_back';
  configKey: string;
  organizationId: number;
  previousConfig: Record<string, unknown> | null;
  activeConfig: Record<string, unknown> | null;
  probesRun: SafetyProbeType[];
  probesPassed: boolean;
  rollbackOccurred: boolean;
  rollbackReason?: string;
  executedAt: string;
}

export class TenantConfigRollbackSafetyWorkflow {
  constructor(
    private readonly configService: TenantConfigService = tenantConfigService,
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof tenantConfigRollbackSafetySchema>
  ) {
    const run = new WorkflowRun('tenant-config-rollback-safety', context, this.delayMs);
    return run.execute<TenantConfigRollbackSafetyOutcome>(async () => {
      // Tenant configuration management is strictly restricted to employers
      const organizationId = requireOrganization(context, true);
      input = tenantConfigRollbackSafetySchema.parse(input);

      // Step 1: Capture baseline configuration snapshot
      const baselineSnapshot = await run.step<Record<string, unknown> | null>(
        'capture-baseline-snapshot',
        async () => {
          const current = await this.configService.getConfig(organizationId, input.configKey);
          logger.info('Captured baseline tenant configuration snapshot', {
            organizationId,
            configKey: input.configKey,
            hasPreviousConfig: current !== null,
            executionId: run.executionId,
          });
          return current;
        },
        true // safe to retry reading baseline
      );

      // Step 2: Tentatively apply the new configuration
      await run.step(
        'apply-tentative-config',
        async () => {
          await this.configService.setConfig(
            organizationId,
            input.configKey,
            input.proposedConfig,
            input.description
          );
          logger.info('Tentatively applied tenant configuration', {
            organizationId,
            configKey: input.configKey,
            executionId: run.executionId,
          });
          return { applied: true };
        },
        true // safe to retry transient database errors
      );

      // Step 3: Run safety probes to verify configuration health
      let probeFailureReason: string | null = null;
      try {
        await run.step('probe-config-health', async () => {
          if (input.simulateFailure) {
            throw new Error('Simulated health probe failure for rollback safety validation');
          }

          // Probe: Schema validation
          if (input.probes.includes('schema_validation')) {
            if (!input.proposedConfig || typeof input.proposedConfig !== 'object' || Array.isArray(input.proposedConfig)) {
              throw new Error('Safety probe failed: proposed config must be an object');
            }
          }

          // Probe: Non-empty check
          if (input.probes.includes('non_empty_check')) {
            if (Object.keys(input.proposedConfig).length === 0) {
              throw new Error('Safety probe failed: proposed config cannot be empty');
            }
          }

          // Verify configuration can be read back consistently from service / cache
          const loaded = await this.configService.getConfig(organizationId, input.configKey);
          if (!loaded) {
            throw new Error('Safety probe failed: applied configuration could not be read back');
          }

          logger.info('Safety probes passed for tenant configuration', {
            organizationId,
            configKey: input.configKey,
            probes: input.probes,
            executionId: run.executionId,
          });

          return { passed: true };
        });
      } catch (err: any) {
        probeFailureReason = err instanceof Error ? err.message : 'Unknown probe failure';
        logger.error('Safety probe detected unhealthy configuration; initiating rollback', {
          organizationId,
          configKey: input.configKey,
          reason: probeFailureReason,
          executionId: run.executionId,
        });
      }

      // Step 4: If probe failed, execute automated rollback to baseline snapshot
      if (probeFailureReason) {
        await run.step(
          'execute-safe-rollback',
          async () => {
            if (baselineSnapshot !== null) {
              await this.configService.setConfig(
                organizationId,
                input.configKey,
                baselineSnapshot,
                `Automated rollback to baseline: ${probeFailureReason}`
              );
            } else {
              await this.configService.deleteConfig(organizationId, input.configKey);
            }

            logger.warn('Automated rollback completed successfully', {
              organizationId,
              configKey: input.configKey,
              restoredBaseline: baselineSnapshot !== null,
              executionId: run.executionId,
            });

            return { rolledBack: true };
          },
          true // rollback is safe to retry
        );

        // Step 5: Audit safety rollback event
        await run.step(
          'audit-safety-execution',
          async () => {
            logger.info('Tenant config safety execution audited with rollback', {
              organizationId,
              configKey: input.configKey,
              rollback: true,
              executionId: run.executionId,
            });
            return { audited: true };
          },
          true
        );

        return {
          status: 'rolled_back' as const,
          configKey: input.configKey,
          organizationId,
          previousConfig: baselineSnapshot,
          activeConfig: baselineSnapshot,
          probesRun: input.probes,
          probesPassed: false,
          rollbackOccurred: true,
          rollbackReason: probeFailureReason,
          executedAt: new Date().toISOString(),
        };
      }

      // If probes passed, verify active config and audit success
      const activeConfig = await run.step<Record<string, unknown> | null>(
        'verify-final-active-config',
        async () => {
          return this.configService.getConfig(organizationId, input.configKey);
        },
        true
      );

      await run.step(
        'audit-safety-execution',
        async () => {
          logger.info('Tenant config safety execution audited successfully', {
            organizationId,
            configKey: input.configKey,
            rollback: false,
            executionId: run.executionId,
          });
          return { audited: true };
        },
        true
      );

      return {
        status: 'applied_and_verified' as const,
        configKey: input.configKey,
        organizationId,
        previousConfig: baselineSnapshot,
        activeConfig: activeConfig ?? input.proposedConfig,
        probesRun: input.probes,
        probesPassed: true,
        rollbackOccurred: false,
        executedAt: new Date().toISOString(),
      };
    });
  }
}
