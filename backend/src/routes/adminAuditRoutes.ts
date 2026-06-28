import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { adminAuditService, AdminAuditFilter, AuditSeverity } from '../services/adminAuditService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFilter(query: Request['query']): AdminAuditFilter {
  const filter: AdminAuditFilter = {};

  if (query.actionType)    filter.actionType    = String(query.actionType);
  if (query.resourceType)  filter.resourceType  = String(query.resourceType);
  if (query.actorId)       filter.actorId       = parseInt(String(query.actorId), 10);
  if (query.severity)      filter.severity      = String(query.severity) as AuditSeverity;
  if (query.fromDate)      filter.fromDate      = new Date(String(query.fromDate));
  if (query.toDate)        filter.toDate        = new Date(String(query.toDate));

  return filter;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Admin Audit
 *   description: Advanced audit log for all administrative actions
 */

/**
 * @swagger
 * /api/v1/admin-audit:
 *   get:
 *     summary: List paginated admin audit log entries
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: actionType
 *         schema: { type: string }
 *         description: Filter by action type (e.g. employee_created)
 *       - in: query
 *         name: resourceType
 *         schema: { type: string }
 *         description: Filter by resource type (e.g. employee, payment)
 *       - in: query
 *         name: actorId
 *         schema: { type: integer }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [info, warning, critical] }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Paginated list of audit entries
 *       403:
 *         description: Forbidden
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(403)
        .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
    }

    const limit  = Math.min(parseInt(String(req.query.limit  ?? '50'), 10) || 50,  200);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'),  10) || 0,   0);
    const filter = parseFilter(req.query);

    const { rows, total } = await adminAuditService.list(organizationId, {
      ...filter,
      limit,
      offset,
    });

    return res.status(200).json({ success: true, data: rows, total, limit, offset });
  } catch (err) {
    console.error('[admin-audit] list error:', err);
    return res
      .status(500)
      .json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
  }
});

/**
 * @swagger
 * /api/v1/admin-audit/summary:
 *   get:
 *     summary: Aggregate counts by action type, resource type, and actor
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit summary statistics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(403)
        .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
    }

    const filter = parseFilter(req.query);
    const summary = await adminAuditService.summary(organizationId, filter);

    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error('[admin-audit] summary error:', err);
    return res
      .status(500)
      .json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
  }
});

/**
 * @swagger
 * /api/v1/admin-audit/export:
 *   get:
 *     summary: Export admin audit log as CSV (max 10 000 rows)
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file attachment
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(403)
        .json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
    }

    const filter = parseFilter(req.query);
    const csv    = await adminAuditService.exportCsv(organizationId, filter);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="admin-audit-${organizationId}-${Date.now()}.csv"`
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[admin-audit] export error:', err);
    return res
      .status(500)
      .json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
  }
});

export default router;
