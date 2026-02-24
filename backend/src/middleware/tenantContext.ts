import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';

// Extend Express Request to include tenant information
declare global {
  namespace Express {
    interface Request {
      tenantId?: number;
      organizationId?: number; // Alias for clarity
    }
  }
}

/**
 * Middleware to extract and validate tenant ID from request
 * Supports multiple extraction methods:
 * 1. URL parameter (:organizationId)
 * 2. Request header (X-Organization-Id)
 * 3. JWT token (future implementation)
 */
export const extractTenantId = (req: Request, res: Response, next: NextFunction) => {
  let tenantId: number | undefined;

  // Method 1: Extract from URL parameters
  if (req.params.organizationId) {
    tenantId = parseInt(req.params.organizationId, 10);
  }

  // Method 2: Extract from headers (useful for non-RESTful endpoints)
  if (!tenantId && req.headers['x-organization-id']) {
    const headerValue = req.headers['x-organization-id'];
    tenantId = parseInt(Array.isArray(headerValue) ? headerValue[0] : headerValue, 10);
  }

  // Method 3: Extract from JWT token (placeholder for future auth implementation)
  // if (!tenantId && req.user?.organizationId) {
  //   tenantId = req.user.organizationId;
  // }

  // Validate tenant ID
  if (!tenantId || isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({
      error: 'Invalid or missing organization ID',
      message: 'A valid organization ID must be provided in the URL or headers',
    });
  }

  // Attach to request object
  req.tenantId = tenantId;
  req.organizationId = tenantId; // Alias for backward compatibility

  next();
};

/**
 * Middleware to set PostgreSQL session variable for RLS
 * This must be called after extractTenantId
 */
export const setTenantContext = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.tenantId) {
    return res.status(500).json({
      error: 'Tenant context not set',
      message: 'extractTenantId middleware must be called before setTenantContext',
    });
  }

  try {
    // Get a client from the pool for this request
    const client = await pool.connect();

    // Set the tenant ID in the PostgreSQL session
    await client.query('SET LOCAL app.current_tenant_id = $1', [req.tenantId]);

    // Store client in request for cleanup
    (req as any).dbClient = client;

    // Ensure client is released after response
    res.on('finish', () => {
      if ((req as any).dbClient) {
        (req as any).dbClient.release();
      }
    });

    res.on('close', () => {
      if ((req as any).dbClient) {
        (req as any).dbClient.release();
      }
    });

    next();
  } catch (error) {
    console.error('Error setting tenant context:', error);
    return res.status(500).json({
      error: 'Failed to set tenant context',
      message: 'An error occurred while establishing tenant isolation',
    });
  }
};

/**
 * Middleware to verify tenant exists and is active
 * Optional but recommended for additional security
 */
export const validateTenant = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.tenantId) {
    return res.status(500).json({
      error: 'Tenant ID not set',
      message: 'extractTenantId middleware must be called before validateTenant',
    });
  }

  try {
    const result = await pool.query(
      'SELECT id, name FROM organizations WHERE id = $1',
      [req.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Organization not found',
        message: `Organization with ID ${req.tenantId} does not exist`,
      });
    }

    // Optionally attach organization info to request
    (req as any).organization = result.rows[0];

    next();
  } catch (error) {
    console.error('Error validating tenant:', error);
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
export const requireTenantContext = [
  extractTenantId,
  validateTenant,
  setTenantContext,
];

/**
 * Lightweight tenant middleware without RLS setup
 * Use for routes that handle tenant context manually
 */
export const requireTenantId = [
  extractTenantId,
  validateTenant,
];
