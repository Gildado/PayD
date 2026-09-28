import { Router } from 'express';
import { TaxController } from '../controllers/taxController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Taxation
 *   description: Tax rules and deduction management
 */

/**
 * @swagger
 * /api/v1/taxes/rules:
 *   post:
 *     summary: Create a new tax rule
 *     tags: [Taxation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/rules', TaxController.createRule);

/**
 * @swagger
 * /api/v1/taxes/rules:
 *   get:
 *     summary: List all tax rules
 *     tags: [Taxation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/rules', TaxController.getRules);

/**
 * @swagger
 * /api/v1/taxes/rules/{id}:
 *   put:
 *     summary: Update a tax rule
 *     tags: [Taxation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.put('/rules/:id', TaxController.updateRule);

/**
 * @swagger
 * /api/v1/taxes/rules/{id}:
 *   delete:
 *     summary: Delete a tax rule
 *     tags: [Taxation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/rules/:id', TaxController.deleteRule);

/**
 * @swagger
 * /api/v1/taxes/calculate:
 *   post:
 *     summary: Calculate deductions for a payment
 *     tags: [Taxation]
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/calculate', TaxController.calculateDeductions);

/**
 * @swagger
 * /api/v1/taxes/reports:
 *   get:
 *     summary: Get tax compliance reports
 *     tags: [Taxation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/reports', TaxController.getReport);

export default router;
