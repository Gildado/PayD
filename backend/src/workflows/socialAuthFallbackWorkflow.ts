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

export const FALLBACK_METHODS = [
  'google',
  'github',
  'magic_link',
  'stellar_wallet',
  'password',
] as const;
export type FallbackMethod = (typeof FALLBACK_METHODS)[number];

export const socialAuthFallbackSchema = z
  .object({
    requestedProvider: z.enum(SUPPORTED_PROVIDERS),
    identifier: z.string().trim().min(1).max(255).optional(), // Email or user identifier
    failureCode: z.string().trim().max(100).optional(),
    preferredFallback: z.enum(FALLBACK_METHODS).optional(),
  })
  .strict();

export interface SocialAuthFallbackOutcome {
  status: 'fallback_selected' | 'magic_link_issued' | 'no_fallback_available';
  primaryProvider: Provider;
  selectedFallback: FallbackMethod;
  availableFallbacks: FallbackMethod[];
  reason: string;
  suggestedAction: {
    type: 'oauth_redirect' | 'magic_link_sent' | 'wallet_connect' | 'credentials_prompt';
    target?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: string;
}

export class SocialAuthFallbackWorkflow {
  constructor(
    private readonly db = pool,
    private readonly delayMs = 100
  ) {}

  async execute(
    context: WorkflowContext,
    input: z.infer<typeof socialAuthFallbackSchema>
  ) {
    const run = new WorkflowRun('social-auth-fallback', context, this.delayMs);
    return run.execute<SocialAuthFallbackOutcome>(async () => {
      // Social auth fallback is scoped to an organization context
      requireOrganization(context);
      input = socialAuthFallbackSchema.parse(input);

      // Step 1: Evaluate primary provider failure
      const failureEval = await run.step('evaluate-primary-failure', async () => {
        if (!SUPPORTED_PROVIDERS.includes(input.requestedProvider)) {
          throw new WorkflowError(
            'VALIDATION_ERROR',
            `Invalid provider. Must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`
          );
        }

        const reason = input.failureCode
          ? `Primary provider ${input.requestedProvider} failed with code: ${input.failureCode}`
          : `Primary provider ${input.requestedProvider} unavailable; initiating fallback orchestration`;

        logger.warn('Evaluating primary social provider failure', {
          provider: input.requestedProvider,
          failureCode: input.failureCode,
          executionId: run.executionId,
        });

        return {
          evaluated: true,
          reason,
        };
      });

      // Step 2: Resolve available fallback authentication methods
      const resolvedMethods = await run.step(
        'resolve-available-methods',
        async () => {
          const alternateSocial: Provider[] = SUPPORTED_PROVIDERS.filter(
            (p) => p !== input.requestedProvider
          );
          const available: FallbackMethod[] = [...alternateSocial];

          // If identifier provided, inspect existing linked identities and auth credentials
          if (input.identifier) {
            const userLookup = await this.db.query<{
              id: number;
              email: string;
              wallet_address: string | null;
              password_hash: string | null;
            }>(
              'SELECT id, email, wallet_address, password_hash FROM users WHERE email = $1 OR id::text = $1 LIMIT 1',
              [input.identifier]
            );

            const user = userLookup?.rows?.[0];
            if (user) {
              if (user.wallet_address) {
                available.push('stellar_wallet');
              }
              if (user.password_hash) {
                available.push('password');
              }

              // Check other linked social identities
              const identities = await this.db.query<{ provider: Provider }>(
                'SELECT provider FROM social_identities WHERE user_id = $1',
                [user.id]
              );
              for (const ident of identities?.rows ?? []) {
                if (ident.provider !== input.requestedProvider && !available.includes(ident.provider)) {
                  available.push(ident.provider);
                }
              }
            }
          }

          // Magic link is always a resilient passwordless fallback
          if (!available.includes('magic_link')) {
            available.push('magic_link');
          }

          return { available };
        },
        true // safe to retry read query
      );

      // Step 3: Determine and prepare selected fallback method
      const fallbackResult = await run.step('orchestrate-fallback-dispatch', async () => {
        let chosen: FallbackMethod;

        if (
          input.preferredFallback &&
          resolvedMethods.available.includes(input.preferredFallback)
        ) {
          chosen = input.preferredFallback;
        } else {
          // Priority order: alternate social -> stellar wallet -> magic link -> password
          const alternateSocial = resolvedMethods.available.find(
            (m) => m !== input.requestedProvider && (m === 'google' || m === 'github')
          );
          if (alternateSocial) {
            chosen = alternateSocial;
          } else if (resolvedMethods.available.includes('stellar_wallet')) {
            chosen = 'stellar_wallet';
          } else if (resolvedMethods.available.includes('magic_link')) {
            chosen = 'magic_link';
          } else {
            chosen = resolvedMethods.available[0] || 'magic_link';
          }
        }

        let suggestedAction: SocialAuthFallbackOutcome['suggestedAction'];
        if (chosen === 'google' || chosen === 'github') {
          suggestedAction = {
            type: 'oauth_redirect',
            target: `/auth/${chosen}`,
            metadata: { provider: chosen },
          };
        } else if (chosen === 'magic_link') {
          suggestedAction = {
            type: 'magic_link_sent',
            target: '/auth/magic-link',
            metadata: { email: input.identifier },
          };
        } else if (chosen === 'stellar_wallet') {
          suggestedAction = {
            type: 'wallet_connect',
            target: '/auth/wallet',
          };
        } else {
          suggestedAction = {
            type: 'credentials_prompt',
            target: '/auth/login',
          };
        }

        return {
          chosen,
          suggestedAction,
        };
      });

      // Step 4: Audit fallback event for observability
      await run.step(
        'audit-fallback-event',
        async () => {
          logger.info('Social auth provider fallback resolved', {
            executionId: run.executionId,
            primaryProvider: input.requestedProvider,
            selectedFallback: fallbackResult.chosen,
            identifier: input.identifier ? '***masked***' : undefined,
          });
          return { audited: true };
        },
        true
      );

      return {
        status:
          fallbackResult.chosen === 'magic_link'
            ? 'magic_link_issued'
            : 'fallback_selected',
        primaryProvider: input.requestedProvider,
        selectedFallback: fallbackResult.chosen,
        availableFallbacks: resolvedMethods.available,
        reason: failureEval.reason,
        suggestedAction: fallbackResult.suggestedAction,
        timestamp: new Date().toISOString(),
      };
    });
  }
}
