/**
 * auditTaxAccess
 *
 * Appends an entry to the append-only admin_audit_log whenever an authorized
 * user accesses tax data. Unlike `auditAction`, this covers reads as well as
 * writes, so every exposure of sensitive tax information is attributable.
 */

import { Request, Response, NextFunction } from 'express';
import { adminAuditService } from '../services/adminAuditService.js';
import logger from '../utils/logger.js';

export function auditTaxAccess(actionType: string, resourceType = 'tax') {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.once('finish', () => {
      // Only successful access is audited; denials are handled by RBAC/logger.
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const organizationId = req.user?.organizationId;
      if (organizationId == null) return;

      void Promise.resolve(adminAuditService
        .log({
          organizationId,
          actionType,
          resourceType,
          resourceId: req.params.id ? String(req.params.id) : undefined,
          actorId: req.user?.id,
          actorEmail: req.user?.email ?? undefined,
          actorIp: req.ip ?? req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
          severity: 'info',
          metadata: { method: req.method, path: req.originalUrl },
        }))
        .catch((error: unknown) => {
          logger.error({ error }, '[auditTaxAccess] failed to write audit entry');
        });
    });

    next();
  };
}
