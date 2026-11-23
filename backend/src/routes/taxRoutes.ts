import { Router } from 'express';
import { TaxController } from '../controllers/taxController.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';
import { auditTaxAccess } from '../middlewares/auditTaxAccess.js';

const router = Router();

// Tax data is sensitive: only authenticated EMPLOYER accounts may access it,
// and every successful access is written to the append-only audit log.
router.use(authenticateJWT);
router.use(authorizeRoles('EMPLOYER'));

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
router.post('/rules', auditTaxAccess('tax_rule_created'), TaxController.createRule);

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
router.get('/rules', auditTaxAccess('tax_rules_listed'), TaxController.getRules);

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
router.put('/rules/:id', auditTaxAccess('tax_rule_updated'), TaxController.updateRule);

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
router.delete('/rules/:id', auditTaxAccess('tax_rule_deleted'), TaxController.deleteRule);

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
router.post(
  '/calculate',
  auditTaxAccess('tax_deductions_calculated'),
  TaxController.calculateDeductions
);

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
router.get('/reports', auditTaxAccess('tax_report_generated'), TaxController.getReport);

export default router;
