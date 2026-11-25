import { Router } from 'express';
import { AssetController } from '../controllers/assetController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';
import { optionalIpWhitelist } from '../middlewares/ipWhitelist.js';
import { recentAuth, RecentAuthLimits } from '../middlewares/recentAuthMiddleware.js';
import require2FAForAdmin from '../middlewares/require2faForAdmin.js';

/**
 * @swagger
 * tags:
 *   name: Assets
 *   description: Asset management (ISSUE/CLAWBACK)
 */

/**
 * @swagger
 * /api/assets/issue:
 *   post:
 *     summary: Issue organization USD
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */

/**
 * @swagger
 * /api/assets/clawback:
 *   post:
 *     summary: Clawback assets
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(optionalIpWhitelist);

router.post('/issue', AssetController.issueOrgUsd);
router.post(
  '/clawback',
  recentAuth(RecentAuthLimits.DESTRUCTIVE),
  require2FAForAdmin,
  AssetController.clawback
);

export default router;
