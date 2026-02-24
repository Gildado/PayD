import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/auth';
import { Pool } from 'pg';
import { config } from '../config/env';

const pool = new Pool({ connectionString: config.DATABASE_URL });

export const authorizeRoles = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
        }

        next();
    };
};

/**
 * Middleware to ensure that an EMPLOYER can only access resources in their own organization.
 * For EMPLOYEE roles, it might depend on the route, but usually they can only see their own data.
 */
export const isolateOrganization = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    const { organizationId } = req.user;
    
    // If the request has an orgId in params or body, verify it matches
    const requestedOrgId = req.params.orgId || req.params.organizationId || req.body.organizationId || req.query.organizationId;

    if (requestedOrgId && Number(requestedOrgId) !== organizationId) {
        return res.status(403).json({ error: 'Access denied: Organization mismatch' });
    }

    // Also check for Stellar public key if provided
    const requestedOrgPublicKey = req.params.orgPublicKey || req.body.orgPublicKey || req.query.orgPublicKey;
    if (requestedOrgPublicKey && organizationId) {
        try {
            const result = await pool.query('SELECT public_key FROM organizations WHERE id = $1', [organizationId]);
            if (result.rows.length === 0 || result.rows[0].public_key !== requestedOrgPublicKey) {
                return res.status(403).json({ error: 'Access denied: Organization public key mismatch' });
            }
        } catch (error) {
            console.error('Error verifying organization public key:', error);
            return res.status(500).json({ error: 'Internal server error during isolation check' });
        }
    }

    next();
};
