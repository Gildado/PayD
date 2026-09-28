/**
 * organizationController
 *
 * Handles CRUD operations on an organization's core profile (name, issuer
 * account). Every mutating operation writes a fire-and-forget audit entry via
 * OrgAuditService so that changes are fully traceable.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { orgAuditService } from '../services/orgAuditService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import { getRedisClient } from '../services/rateLimitService.js';
import { getStellarServer } from '../stellar/index.js';

const ORG_CACHE_TTL = 300; // 5 minutes

function orgCacheKey(organizationId: number | string): string {
  return `org:settings:${organizationId}`;
}

async function invalidateOrgCache(organizationId: number | string): Promise<void> {
  const redis = getRedisClient();
  if (redis) await redis.del(orgCacheKey(organizationId));
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const updateNameSchema = z.object({
  name: z.string().min(1).max(255).trim(),
});

const updateIssuerSchema = z.object({
  issuerAccount: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/, 'Must be a valid Stellar public key (starts with G, 56 chars)'),
});

// ─── Controller ───────────────────────────────────────────────────────────────

export const OrganizationController = {
  /**
   * GET /api/v1/organizations/me
   * Returns the current organization's profile.
   */
  async getMe(req: Request, res: Response) {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(403)
        .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
    }

    try {
      const redis = getRedisClient();
      const cacheKey = orgCacheKey(organizationId);

      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.status(200).json({ success: true, data: JSON.parse(cached) });
        }
      }

      const result = await pool.query<{
        id: number;
        name: string;
        issuer_account: string | null;
        created_at: string;
        updated_at: string;
      }>('SELECT id, name, issuer_account, created_at, updated_at FROM organizations WHERE id = $1', [
        organizationId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json(apiErrorResponse(ErrorCodes.NOT_FOUND, 'Organization not found'));
      }

      if (redis) await redis.setex(cacheKey, ORG_CACHE_TTL, JSON.stringify(result.rows[0]));

      return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[OrganizationController.getMe]', err);
      return res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
    }
  },

  /**
   * PATCH /api/v1/organizations/me/name
   * Update the organization's display name.
   */
  async updateName(req: Request, res: Response) {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(403)
        .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
    }

    const parsed = updateNameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json(
          apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', parsed.error.issues)
        );
    }

    try {
      // Fetch old value before mutating
      const oldRow = await pool.query<{ name: string }>(
        'SELECT name FROM organizations WHERE id = $1',
        [organizationId]
      );
      const oldName = oldRow.rows[0]?.name ?? null;

      const result = await pool.query<{ id: number; name: string; updated_at: string }>(
        'UPDATE organizations SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, updated_at',
        [parsed.data.name, organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json(apiErrorResponse(ErrorCodes.NOT_FOUND, 'Organization not found'));
      }

      void orgAuditService.log({
        organizationId,
        changeType: 'name_updated',
        oldValue: oldName,
        newValue: parsed.data.name,
        actorId: req.user?.id,
        actorEmail: req.user?.email ?? undefined,
        actorIp: req.ip,
      });

      void invalidateOrgCache(organizationId);

      return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[OrganizationController.updateName]', err);
      return res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
    }
  },

  /**
   * PATCH /api/v1/organizations/me/issuer
   * Update the organization's Stellar issuer account address.
   */
  async updateIssuer(req: Request, res: Response) {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(403)
        .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
    }

    const parsed = updateIssuerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json(
          apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', parsed.error.issues)
        );
    }

    try {
      // Verify the account exists on-chain before trusting it as an issuer
      try {
        const server = getStellarServer();
        await server.loadAccount(parsed.data.issuerAccount);
      } catch (horizonErr: unknown) {
        const status =
          horizonErr &&
          typeof horizonErr === 'object' &&
          'response' in horizonErr &&
          (horizonErr as { response?: { status?: number } }).response?.status === 404
            ? 404
            : null;
        if (status === 404) {
          return res
            .status(422)
            .json(
              apiErrorResponse(
                ErrorCodes.VALIDATION_ERROR,
                'The provided account does not exist on the Stellar network'
              )
            );
        }
        // Horizon is unreachable — fail safe rather than silently accepting
        console.error('[OrganizationController.updateIssuer] Horizon error', horizonErr);
        return res
          .status(502)
          .json(
            apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Unable to reach the Stellar network')
          );
      }

      // Fetch old issuer before mutating
      const oldRow = await pool.query<{ issuer_account: string | null }>(
        'SELECT issuer_account FROM organizations WHERE id = $1',
        [organizationId]
      );
      const oldIssuer = oldRow.rows[0]?.issuer_account ?? null;

      const result = await pool.query<{
        id: number;
        issuer_account: string;
        updated_at: string;
      }>(
        'UPDATE organizations SET issuer_account = $1, updated_at = NOW() WHERE id = $2 RETURNING id, issuer_account, updated_at',
        [parsed.data.issuerAccount, organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json(apiErrorResponse(ErrorCodes.NOT_FOUND, 'Organization not found'));
      }

      void orgAuditService.log({
        organizationId,
        changeType: 'issuer_updated',
        oldValue: oldIssuer,
        newValue: parsed.data.issuerAccount,
        actorId: req.user?.id,
        actorEmail: req.user?.email ?? undefined,
        actorIp: req.ip,
      });

      void invalidateOrgCache(organizationId);

      return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err) {
      console.error('[OrganizationController.updateIssuer]', err);
      return res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
    }
  },
};
