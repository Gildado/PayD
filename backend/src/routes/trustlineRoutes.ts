import { Router } from 'express';
import { TrustlineController } from '../controllers/trustlineController.js';
import authenticateJWT from '../middlewares/auth.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Trustlines
 *   description: Stellar asset trustline management
 */

/**
 * @swagger
 * /api/v1/trustline/check/{walletAddress}:
 *   get:
 *     summary: Detect trustline status via Horizon
 *     tags: [Trustlines]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
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
router.get('/check/:walletAddress', TrustlineController.checkWallet);

/**
 * @swagger
 * /api/v1/trustline/employees/{employeeId}:
 *   get:
 *     summary: Get stored trustline status for an employee
 *     tags: [Trustlines]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/employees/:employeeId', TrustlineController.getEmployeeStatus);

/**
 * @swagger
 * /api/v1/trustline/employees/{employeeId}/refresh:
 *   post:
 *     summary: Update trustline status in DB from Horizon
 *     tags: [Trustlines]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assetIssuer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/employees/:employeeId/refresh', authenticateJWT, TrustlineController.refreshEmployee);

/**
 * @swagger
 * /api/v1/trustline/prompt:
 *   post:
 *     summary: Build unsigned changeTrust XDR
 *     tags: [Trustlines]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               employeeId:
 *                 type: integer
 *               walletAddress:
 *                 type: string
 *               assetIssuer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/prompt', TrustlineController.promptTrustline);

export default router;
