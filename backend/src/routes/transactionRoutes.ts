import { Router } from 'express';
import { TransactionController } from '../controllers/transactionController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management with pagination
 */

/**
 * @swagger
 * /api/v1/transactions:
 *   get:
 *     summary: List transactions with pagination
 *     tags: [Transactions]
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
router.get('/', authenticateJWT, isolateOrganization, TransactionController.listTransactions);

export default router;
