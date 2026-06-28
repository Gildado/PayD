import { Router } from 'express';
import { FreezeController } from '../controllers/freezeController.js';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles, isolateOrganization } from '../middlewares/rbac.js';
import { optionalIpWhitelist } from '../middlewares/ipWhitelist.js';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));
router.use(isolateOrganization);
router.use(optionalIpWhitelist);

/**
 * @swagger
 * tags:
 *   name: Freeze
 *   description: Administrative asset freeze and unfreeze operations
 */

// Apply a slightly stricter rate limit for administrative actions
const adminRateLimit = rateLimitMiddleware({ tier: 'api' });

// ---------------------------------------------------------------------------
// Account-level Freeze Operations
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/freeze/account/freeze:
 *   post:
 *     summary: Freeze an account's trustline
 *     tags: [Freeze]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetAccount:
 *                 type: string
 *               assetCode:
 *                 type: string
 *               assetIssuer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/account/freeze', adminRateLimit, FreezeController.freezeAccount);

/**
 * @swagger
 * /api/v1/freeze/account/unfreeze:
 *   post:
 *     summary: Unfreeze an account's trustline
 *     tags: [Freeze]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetAccount:
 *                 type: string
 *               assetCode:
 *                 type: string
 *               assetIssuer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/account/unfreeze', adminRateLimit, FreezeController.unfreezeAccount);

// ---------------------------------------------------------------------------
// Global Freeze Operations (All Holders)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/freeze/global/freeze:
 *   post:
 *     summary: Pause transfers globally for an asset
 *     tags: [Freeze]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assetCode:
 *                 type: string
 *               assetIssuer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/global/freeze', adminRateLimit, FreezeController.freezeGlobal);

/**
 * @swagger
 * /api/v1/freeze/global/unfreeze:
 *   post:
 *     summary: Restore transfers globally for an asset
 *     tags: [Freeze]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assetCode:
 *                 type: string
 *               assetIssuer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/global/unfreeze', adminRateLimit, FreezeController.unfreezeGlobal);

// ---------------------------------------------------------------------------
// Status & Audit
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/v1/freeze/status/{targetAccount}:
 *   get:
 *     summary: Query the active freeze status of an account
 *     tags: [Freeze]
 *     parameters:
 *       - in: path
 *         name: targetAccount
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: assetCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: assetIssuer
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/status/:targetAccount', FreezeController.checkStatus);

/**
 * @swagger
 * /api/v1/freeze/logs:
 *   get:
 *     summary: History of all freeze and unfreeze actions
 *     tags: [Freeze]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: targetAccount
 *         schema:
 *           type: string
 *       - in: query
 *         name: assetCode
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/logs', FreezeController.getLogs);

export default router;
