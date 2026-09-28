/**
 * Contract Routes
 * Defines routes for the Contract Address Registry API
 */

import { Router } from 'express';
import { ContractController } from '../controllers/contractController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Contract Registry
 *   description: Deployed contract address registry
 */

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Returns all deployed contract addresses with metadata
 *     tags: [Contract Registry]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/contracts', ContractController.getContracts);

export default router;
