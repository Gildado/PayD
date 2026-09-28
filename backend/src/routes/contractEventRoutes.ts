import { Router } from 'express';
import { ContractEventsController } from '../controllers/contractEventsController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Contract Events
 *   description: On-chain contract event indexing
 */

/**
 * @swagger
 * /api/events/{contractId}:
 *   get:
 *     summary: List indexed contract events
 *     tags: [Contract Events]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/:contractId', ContractEventsController.listByContract);

export default router;
