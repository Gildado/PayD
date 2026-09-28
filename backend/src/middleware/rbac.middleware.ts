// backend/src/middleware/rbac.middleware.ts
import { Request, Response, NextFunction } from 'express';

export enum UserRole {
    ADMIN = 'ADMIN',
    FINANCE_MANAGER = 'FINANCE_MANAGER',
    EMPLOYEE = 'EMPLOYEE',
}

export const requireRole = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user || !user.role) {
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

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
                    message: `Access denied. Role '${user.role}' does not possess required permissions for this endpoint.`,
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