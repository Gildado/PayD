/**
 * Contract Routes
 * Defines routes for the Contract Address Registry API
 */

import { Router } from 'express';
import { ContractController } from '../controllers/contractController.js';

const router = Router();

/**
 * GET /contracts
 * Returns all deployed contract addresses with metadata
 */
router.get('/contracts', ContractController.getContracts);

export default router;
