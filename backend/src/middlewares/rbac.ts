import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/auth.js';
import { pool } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Authorizes requests based on user role.
 * Returns structured error responses with meta information.
 */
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication credentials missing or invalid for RBAC evaluation',
        },
        meta: {
          timestamp: new Date().toISOString(),
          traceId: req.headers['x-request-id'] || null,
        },
      });
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Role '${req.user.role}' does not possess required permissions for this endpoint.`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          traceId: req.headers['x-request-id'] || null,
        },
      });
    }

    next();
  };
};

/**
 * Alias for authorizeRoles to maintain backward compatibility with different naming convention.
 * @deprecated Use authorizeRoles instead
 */
export const requireRole = (...roles: UserRole[]) => authorizeRoles(...roles);

/**
 * Middleware to ensure that an EMPLOYER can only access resources in their own organization.
 * For EMPLOYEE roles, it might depend on the route, but usually they can only see their own data.
 */
export const isolateOrganization = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication credentials missing or invalid',
      },
      meta: {
        timestamp: new Date().toISOString(),
        traceId: req.headers['x-request-id'] || null,
      },
    });
  }

  const { organizationId } = req.user;
  if (organizationId) {
    req.organizationId = organizationId;
    req.tenantId = organizationId;
  }

  // If the request has an orgId in params or body, verify it matches
  const requestedOrgId =
    req.params.orgId ||
    req.params.organizationId ||
    req.body.organizationId ||
    req.query.organizationId;

  if (requestedOrgId && Number(requestedOrgId) !== organizationId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN_ORGANIZATION_MISMATCH',
        message: 'Access denied: Organization mismatch',
      },
      meta: {
        timestamp: new Date().toISOString(),
        traceId: req.headers['x-request-id'] || null,
      },
    });
  }

  // Also check for Stellar public key if provided
  const requestedOrgPublicKey =
    req.params.orgPublicKey || req.body.orgPublicKey || req.query.orgPublicKey;
  if (requestedOrgPublicKey && organizationId) {
    try {
      const result = await pool.query('SELECT public_key FROM organizations WHERE id = $1', [
        organizationId,
      ]);
      if (result.rows.length === 0 || result.rows[0].public_key !== requestedOrgPublicKey) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_PUBLIC_KEY_MISMATCH',
            message: 'Access denied: Organization public key mismatch',
          },
          meta: {
            timestamp: new Date().toISOString(),
            traceId: req.headers['x-request-id'] || null,
          },
        });
      }
    } catch (error) {
      logger.error({ error }, '[rbac] Error verifying organization public key');
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error during isolation check',
        },
        meta: {
          timestamp: new Date().toISOString(),
          traceId: req.headers['x-request-id'] || null,
        },
      });
    }
  }

  next();
};
