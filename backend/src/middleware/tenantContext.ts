import { Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

/** Minimal shape of the organization row attached by `validateTenant`. */
export interface TenantOrganization {
  id: number;
  name: string;
}

// Extend Express Request with strongly typed tenant information. Keeping these
// fields on the typed Request (instead of casting to `any`) makes it impossible
// for an untyped fallback value to silently become a tenant context.
declare global {
  namespace Express {
    interface Request {
      /** Validated, positive tenant/organization identifier for this request. */
      tenantId?: number;
      /** Alias for `tenantId`, kept for backwards compatibility. */
      organizationId?: number;
      /** Pool client checked out for RLS setup; released after the response. */
      dbClient?: PoolClient;
      /** Organization row loaded by `validateTenant`. */
      organization?: TenantOrganization;
    }
  }
}

/**
 * Strictly parse a tenant identifier. `parseInt` is deliberately avoided:
 * values such as `"12abc"` or `"1.5"` must never be coerced into a tenant.
 * Returns `undefined` for anything that is not a positive safe integer.
 */
export function parseTenantId(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return undefined;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

/**
 * Single, consistent 4xx response for a missing or invalid tenant.
 * There is intentionally NO default-tenant fallback: an absent/invalid
 * organization never resolves to a shared or configured tenant id.
 */
const INVALID_TENANT_BODY = {
  error: 'Invalid or missing organization ID',
  message: 'A valid organization ID must be provided in the URL or headers',
} as const;

function rejectInvalidTenant(res: Response) {
  return res.status(400).json(INVALID_TENANT_BODY);
}

function hasTenantId(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Middleware to extract and validate tenant ID from request.
 * Supports multiple extraction methods (in priority order):
 * 1. URL parameter (:organizationId)
 * 2. Request header (X-Organization-Id)
 * 3. Authenticated user context (req.user.organizationId)
 *
 * If a source is present but invalid, the request is rejected immediately —
 * we never skip to a lower-priority source or fall back to a default tenant.
 */
export const extractTenantId = (req: Request, res: Response, next: NextFunction) => {
  const headerValue = req.headers['x-organization-id'];
  const headerTenant = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  const candidates: { value: unknown }[] = [
    { value: req.params?.organizationId },
    { value: headerTenant },
    { value: req.user?.organizationId },
  ];

  for (const candidate of candidates) {
    if (!hasTenantId(candidate.value)) continue;

    const tenantId = parseTenantId(candidate.value);
    if (tenantId === undefined) {
      return rejectInvalidTenant(res);
    }

    req.tenantId = tenantId;
    req.organizationId = tenantId; // Alias for backwards compatibility
    next();
    return;
  }

  // No tenant source was supplied: reject rather than selecting a default.
  return rejectInvalidTenant(res);
};

/**
 * Middleware to set PostgreSQL session variable for RLS.
 * This must be called after extractTenantId.
 */
export const setTenantContext = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = parseTenantId(req.tenantId);
  if (tenantId === undefined) {
    return rejectInvalidTenant(res);
  }

  try {
    // Get a client from the pool for this request
    const client = await pool.connect();

    // Set tenant context for this DB session so RLS policies can enforce isolation.
    // tenantId is a validated positive integer, so interpolation is safe here.
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);

    // Store client in the typed request field for cleanup
    req.dbClient = client;

    // Ensure client is released exactly once after response.
    let released = false;
    const cleanup = async () => {
      if (released) return;
      const checkedOutClient = req.dbClient;
      if (!checkedOutClient) return;
      released = true;
      try {
        await checkedOutClient.query('RESET app.current_tenant_id');
      } catch {
        // Ignore cleanup reset errors to avoid masking the response lifecycle.
      }
      checkedOutClient.release();
      req.dbClient = undefined;
    };
    res.on('finish', () => {
      void cleanup();
    });
    res.on('close', () => {
      void cleanup();
    });

    next();
  } catch (error) {
    logger.error('Error setting tenant context', error);
    return res.status(500).json({
      error: 'Failed to set tenant context',
      message: 'An error occurred while establishing tenant isolation',
    });
  }
};

/**
 * Middleware to verify tenant exists and is active.
 * Optional but recommended for additional security.
 */
export const validateTenant = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = parseTenantId(req.tenantId);
  if (tenantId === undefined) {
    return rejectInvalidTenant(res);
  }

  try {
    const result = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Organization not found',
        message: `Organization with ID ${tenantId} does not exist`,
      });
    }

    const row = result.rows[0] as TenantOrganization | undefined;
    if (row) {
      req.organization = row;
    }

    next();
  } catch (error) {
    logger.error('Error validating tenant', error);
    return res.status(500).json({
      error: 'Failed to validate tenant',
      message: 'An error occurred while validating the organization',
    });
  }
};

/**
 * Combined middleware that handles full tenant context setup
 * Use this for most routes that require tenant isolation
 */
export const requireTenantContext = [extractTenantId, validateTenant, setTenantContext];

/**
 * Lightweight tenant middleware without RLS setup
 * Use for routes that handle tenant context manually
 */
export const requireTenantId = [extractTenantId, validateTenant];
