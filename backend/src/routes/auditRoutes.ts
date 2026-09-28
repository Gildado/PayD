import { Router } from 'express';
import { TransactionAuditController } from '../controllers/transactionAuditController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Audit
 *   description: Transaction audit management
 */

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: List audit records with pagination
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', TransactionAuditController.listAuditRecords);

/**
 * @swagger
 * /api/audit/{txHash}:
 *   get:
 *     summary: Get a stored audit record by transaction hash
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:txHash', TransactionAuditController.getAuditRecord);

/**
 * @swagger
 * /api/audit/{txHash}/verify:
 *   get:
 *     summary: Verify integrity of a stored audit record
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:txHash/verify', TransactionAuditController.verifyAuditRecord);

/**
 * @swagger
 * /api/audit/{txHash}:
 *   post:
 *     summary: Create an audit record for a transaction
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: txHash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/:txHash', TransactionAuditController.createAuditRecord);

export default router;
