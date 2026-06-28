import { Router, Request, Response } from 'express';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { orgAuditService } from '../services/orgAuditService.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);

/**
 * GET /api/org-audit
 * Returns paginated organization audit log entries for the authenticated org.
 *
 * Query params:
 *   limit  – max rows per page (default 50, max 200)
 *   offset – rows to skip (default 0)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(403).json(apiErrorResponse(ErrorCodes.FORBIDDEN, 'User is not associated with an organization'));
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

    const { rows, total } = await orgAuditService.list(organizationId, { limit, offset });
    return res.status(200).json({ success: true, data: rows, total, limit, offset });
  } catch (err) {
    console.error('org-audit list error:', err);
    return res.status(500).json(apiErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal Server Error'));
  }
});

export default router;
