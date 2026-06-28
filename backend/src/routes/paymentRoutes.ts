import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { require2FA } from '../middlewares/require2fa.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Cross-border and cross-asset payments
 */

router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @swagger
 * /api/v1/payments/anchor-info:
 *   get:
 *     summary: Get SEP-31 anchor configuration
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
/**
 * @swagger
 * /api/v1/payments/sep31/initiate:
 *   post:
 *     summary: Initiate a SEP-31 cross-border payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Accepted
 */
/**
 * @swagger
 * /api/v1/payments/sep31/status/{domain}/{id}:
 *   get:
 *     summary: Query SEP-31 payment status
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */

router.get('/anchor-info', PaymentController.getAnchorInfo);
router.post('/pathfind', PaymentController.findPaths);
router.post('/sep31/initiate', require2FA, PaymentController.initiateSEP31);
router.get('/sep31/status/:domain/:id', PaymentController.getStatus);
router.post('/sep24/withdraw/interactive', require2FA, PaymentController.initiateSEP24Withdrawal);
router.get('/sep24/status/:domain/:id', PaymentController.getSEP24Status);

export default router;
