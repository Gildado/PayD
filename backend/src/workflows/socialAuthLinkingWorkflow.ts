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

export const SUPPORTED_PROVIDERS = ['google', 'github'] as const;
export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

export const socialAuthLinkingSchema = z
  .object({
    provider: z.enum(SUPPORTED_PROVIDERS),
    providerId: z.string().trim().min(1).max(255),
    userId: z.number().int().positive().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export interface SocialAuthLinkOutcome {
  status: 'linked' | 'already_linked';
  provider: Provider;
  providerId: string;
  userId: number;
  linkedAt: string;
  identityId?: number;
}

export class SocialAuthLinkingWorkflow {
  constructor(
    private readonly db = pool,
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof socialAuthLinkingSchema>
  ) {
    const run = new WorkflowRun('social-auth-linking', context, this.delayMs);
    return run.execute<SocialAuthLinkOutcome>(async () => {
      requireOrganization(context);
      input = socialAuthLinkingSchema.parse(input);

      // Determine target user id (scoped to verified JWT context)
      const targetUserId = input.userId ?? context.id;
      if (context.role !== 'EMPLOYER' && targetUserId !== context.id) {
        throw new WorkflowError('FORBIDDEN', 'Cannot link social identity for another user.', 403);
      }

      // Step 1: Validate payload parameters
      await run.step('validate-social-payload', async () => {
        if (!SUPPORTED_PROVIDERS.includes(input.provider)) {
          throw new WorkflowError(
            'VALIDATION_ERROR',
            `Unsupported provider. Must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`
          );
        }
        if (!input.providerId || input.providerId.trim() === '') {
          throw new WorkflowError('VALIDATION_ERROR', 'Provider ID is required.');
        }
        return { validated: true };
      });

      // Step 2: Verify provider identity is not already claimed
      const existing = await run.step('verify-target-availability', async () => {
        const result = await this.db.query<{ id: number; user_id: number; provider: Provider; provider_id: string }>(
          'SELECT id, user_id, provider, provider_id FROM social_identities WHERE provider = $1 AND provider_id = $2',
          [input.provider, input.providerId]
        );

        const row = result.rows[0];
        if (row) {
          if (row.user_id !== targetUserId) {
            throw new WorkflowError(
              'CONFLICT',
              'This social identity is already linked to another account.',
              409
            );
          }
          return { alreadyLinked: true, identityId: row.id };
        }

        return { alreadyLinked: false };
      });

      if (existing.alreadyLinked) {
        return {
          status: 'already_linked',
          provider: input.provider,
          providerId: input.providerId,
          userId: targetUserId,
          linkedAt: new Date().toISOString(),
          identityId: existing.identityId,
        };
      }

      // Step 3: Verify user account ownership and active state
      await run.step('verify-account-ownership', async () => {
        const userResult = await this.db.query<{ id: number }>(
          'SELECT id FROM users WHERE id = $1',
          [targetUserId]
        );

        if (!userResult.rows[0]) {
          throw new WorkflowError('NOT_FOUND', 'Target user account not found.', 404);
        }
        return { userFound: true };
      });

      // Step 4: Persist social identity linking
      return run.step(
        'link-social-identity',
        async () => {
          const insertResult = await this.db.query<{ id: number; created_at: string }>(
            `INSERT INTO social_identities (user_id, provider, provider_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (provider, provider_id) DO NOTHING
             RETURNING id, created_at`,
            [targetUserId, input.provider, input.providerId]
          );

          const inserted = insertResult.rows[0];
          logger.info('Social identity successfully linked', {
            userId: targetUserId,
            provider: input.provider,
            executionId: run.executionId,
          });

          return {
            status: 'linked' as const,
            provider: input.provider,
            providerId: input.providerId,
            userId: targetUserId,
            linkedAt: inserted?.created_at ? new Date(inserted.created_at).toISOString() : new Date().toISOString(),
            identityId: inserted?.id,
          };
        },
        true // safe to retry transient database blips
      );
    });
  }
}
