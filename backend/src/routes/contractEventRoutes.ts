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
 * /api/v1/events/{contractId}:
 *   get:
 *     summary: List indexed contract events
 *     tags: [Contract Events]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: eventType
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated contract events }
 */
router.get('/:contractId', ContractEventsController.listByContract);

/**
 * @swagger
 * /api/v1/events/{contractId}/stats:
 *   get:
 *     summary: Get indexed event statistics for a contract
 *     tags: [Contract Events]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Contract event statistics }
 */
router.get('/:contractId/stats', ContractEventsController.getEventStats);

/**
 * @swagger
 * /api/v1/events/{contractId}/search:
 *   get:
 *     summary: Search indexed events for a contract
 *     tags: [Contract Events]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: query
 *         schema: { type: string }
 *       - in: query
 *         name: eventType
 *         schema: { type: string }
 *       - in: query
 *         name: ledgerFrom
 *         schema: { type: integer }
 *       - in: query
 *         name: ledgerTo
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200: { description: Matching contract events }
 */
router.get('/:contractId/search', ContractEventsController.searchEvents);

/**
 * @swagger
 * /api/v1/events/indexer/status:
 *   get:
 *     summary: Get the contract event indexer status
 *     tags: [Contract Events]
 *     security: []
 *     responses:
 *       200: { description: Event indexer status }
 */
router.get('/indexer/status', ContractEventsController.getIndexerStatus);

export default router;
