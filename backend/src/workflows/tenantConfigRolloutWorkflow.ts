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

export const tenantConfigRolloutSchema = z
  .object({
    configKey: z.string().trim().min(1).max(100),
    configValue: z.record(z.unknown()),
    description: z.string().trim().max(500).optional(),
    dryRun: z.boolean().default(false),
  })
  .strict();

export interface TenantConfigRolloutOutcome {
  status: 'rolled_out' | 'dry_run_passed';
  configKey: string;
  organizationId: number;
  previousConfig: Record<string, unknown> | null;
  appliedConfig: Record<string, unknown>;
  dryRun: boolean;
  rolledOutAt: string;
  description?: string;
}

export class TenantConfigRolloutWorkflow {
  constructor(
    private readonly configService: TenantConfigService = tenantConfigService,
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof tenantConfigRolloutSchema>
  ) {
    const run = new WorkflowRun('tenant-config-rollout', context, this.delayMs);
    return run.execute<TenantConfigRolloutOutcome>(async () => {
      // Configuration rollout is strictly employer/admin scoped
      const organizationId = requireOrganization(context, true);
      input = tenantConfigRolloutSchema.parse(input);

      // Step 1: Validate config key and payload schema
      await run.step('validate-config-schema', async () => {
        if (!input.configKey || input.configKey.trim().length === 0) {
          throw new WorkflowError('VALIDATION_ERROR', 'A valid configuration key is required.');
        }
        if (!input.configValue || typeof input.configValue !== 'object' || Array.isArray(input.configValue)) {
          throw new WorkflowError('VALIDATION_ERROR', 'Configuration value must be a valid JSON object.');
        }
        return { valid: true };
      });

      // Step 2: Stage rollout by checking current configuration
      const previousConfig = await run.step<Record<string, unknown> | null>(
        'stage-config-rollout',
        async () => {
          return this.configService.getConfig(organizationId, input.configKey);
        }
      );

      // If dry run requested, skip application step
      if (input.dryRun) {
        return {
          status: 'dry_run_passed',
          configKey: input.configKey,
          organizationId,
          previousConfig,
          appliedConfig: input.configValue,
          dryRun: true,
          rolledOutAt: new Date().toISOString(),
          description: input.description,
        };
      }

      // Step 3: Apply tenant configuration atomically (updates DB and invalidates Redis cache)
      await run.step(
        'apply-tenant-config',
        async () => {
          await this.configService.setConfig(
            organizationId,
            input.configKey,
            input.configValue,
            input.description
          );
          logger.info('Applied tenant configuration', {
            organizationId,
            configKey: input.configKey,
            executionId: run.executionId,
          });
          return { applied: true };
        },
        true // safe to retry transient persistence errors
      );

      // Step 4: Verify rollout consistency across storage and cache
      const verified = await run.step(
        'verify-config-rollout',
        async () => {
          const loaded = await this.configService.getConfig(organizationId, input.configKey);
          if (!loaded) {
            throw new WorkflowError(
              'VERIFICATION_FAILED',
              'Configuration rollout verification failed: configuration not readable.'
            );
          }
          return loaded;
        },
        true // safe to retry transient read/cache issues
      );

      return {
        status: 'rolled_out' as const,
        configKey: input.configKey,
        organizationId,
        previousConfig,
        appliedConfig: verified as Record<string, unknown>,
        dryRun: false,
        rolledOutAt: new Date().toISOString(),
        description: input.description,
      };
    });
  }
}
