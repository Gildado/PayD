import { Request, Response } from 'express';
import { Pool } from 'pg';
import { config } from '../config/env.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });

const SUPPORTED_PROVIDERS = ['google', 'github'] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

export const SocialAuthController = {
  /**
   * GET /auth/social-identities
   * Returns all social identities linked to the authenticated user.
   */
  async listIdentities(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Authentication required'));
    }

    try {
      const result = await pool.query(
        `SELECT provider, provider_id, created_at
         FROM social_identities
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId]
      );

      return res.status(200).json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error('[SocialAuth] listIdentities error:', err);
      return res
        .status(500)
        .json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to retrieve social identities'));
    }
  },

  /**
   * DELETE /auth/social-identities/:provider
   * Unlinks a specific OAuth provider from the authenticated user's account.
   * Requires the user to have at least one other login method (wallet or password).
   */
  async unlinkProvider(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json(apiErrorResponse(ErrorCodes.UNAUTHORIZED, 'Authentication required'));
    }

    const provider = req.params.provider as Provider;
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return res
        .status(400)
        .json(
          apiErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            `Unsupported provider. Must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`
          )
        );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check the identity to unlink actually exists for this user
      const identityResult = await client.query(
        'SELECT id FROM social_identities WHERE user_id = $1 AND provider = $2',
        [userId, provider]
      );
      if (identityResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res
          .status(404)
          .json(
            apiErrorResponse(ErrorCodes.NOT_FOUND, `No linked ${provider} identity found for this account`)
          );
      }

      // Safety check: ensure at least one other auth method remains
      const userResult = await client.query(
        'SELECT wallet_address, password_hash FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      const remainingIdentitiesResult = await client.query(
        'SELECT COUNT(*) FROM social_identities WHERE user_id = $1 AND provider != $2',
        [userId, provider]
      );
      const remainingCount = parseInt(remainingIdentitiesResult.rows[0].count, 10);

      const hasWallet = Boolean(user?.wallet_address);
      const hasPassword = Boolean(user?.password_hash);
      if (!hasWallet && !hasPassword && remainingCount === 0) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json(
            apiErrorResponse(
              ErrorCodes.CONFLICT,
              'Cannot unlink the only login method. Add a password or another provider first.'
            )
          );
      }

      await client.query(
        'DELETE FROM social_identities WHERE user_id = $1 AND provider = $2',
        [userId, provider]
      );

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `${provider} account successfully unlinked`,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[SocialAuth] unlinkProvider error:', err);
      return res
        .status(500)
        .json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to unlink social identity'));
    } finally {
      client.release();
    }
  },
};
