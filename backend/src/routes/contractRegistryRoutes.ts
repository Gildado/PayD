
import { Router } from 'express';
import { ContractRegistryController } from '../controllers/contractRegistryController.js';

const router = Router();

/**
 * GET /api/contracts
 * Optional: ?network=testnet
 */
router.get('/contracts', ContractRegistryController.getContracts);

export default router;