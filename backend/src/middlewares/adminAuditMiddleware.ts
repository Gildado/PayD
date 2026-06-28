/**
 * adminAuditMiddleware
 *
 * Express middleware factory that wraps a route and automatically appends an
 * entry to admin_audit_log after every successful mutating request (POST /
 * PUT / PATCH / DELETE).
 *
 * Usage (in a router file):
 *
 *   import { auditAction } from '../middlewares/adminAuditMiddleware.js';
 *
 *   router.post(
 *     '/employees',
 *     auditAction('employee_created', 'employee', { severity: 'info' }),
 *     employeeController.create
 *   );
 *
 * The middleware reads the JSON response body via response interception, so it
 * captures the created / updated resource automatically as new_state.
 */

import { Request, Response, NextFunction } from 'express';
import {
  adminAuditService,
  AdminActionType,
  AuditSeverity,
} from '../services/adminAuditService.js';

export interface AuditActionOptions {
  severity?: AuditSeverity;
  /** Override the resource ID field extracted from res.locals or req.params */
  resourceIdField?: string;
}

/**
 * Returns Express middleware that logs an admin action after the response is sent.
 *
 * @param actionType   The admin action being performed (e.g. 'employee_created')
 * @param resourceType The resource category (e.g. 'employee', 'payment')
 * @param options      Optional overrides for severity and resource ID field
 */
export function auditAction(
  actionType: AdminActionType,
  resourceType: string,
  options: AuditActionOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      const result = originalJson(body);

      // Only log on successful mutating requests
      const method = req.method.toUpperCase();
      const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const successful = res.statusCode >= 200 && res.statusCode < 300;

      if (mutating && successful && req.user?.organizationId) {
        const resourceIdField = options.resourceIdField ?? 'id';
        const bodyObj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
        const dataObj = (bodyObj['data'] as Record<string, unknown>) ?? bodyObj;
        const resourceId =
          req.params[resourceIdField] ??
          (dataObj[resourceIdField] !== undefined
            ? String(dataObj[resourceIdField])
            : undefined);

        adminAuditService
          .log({
            organizationId: req.user.organizationId,
            actionType,
            resourceType,
            resourceId,
            newState: method !== 'DELETE' ? dataObj : undefined,
            actorId: req.user.id,
            actorEmail: req.user.email ?? undefined,
            actorIp: req.ip ?? req.socket?.remoteAddress,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
            severity: options.severity ?? 'info',
          })
          .catch((err) =>
            console.error('[adminAuditMiddleware] fire-and-forget error:', err)
          );
      }

      return result;
    } as typeof res.json;

    next();
  };
}
