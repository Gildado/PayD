import { Router } from 'express';
import { ContractEventsController } from '../controllers/contractEventsController.js';

const router = Router();

/**
 * @route GET /api/events/:contractId
 * @desc Get paginated events for a specific contract
 * @access Public
 * @query {page?, limit?, eventType?, category?}
 */
router.get('/:contractId', ContractEventsController.listByContract);

/**
 * @route GET /api/events/:contractId/stats
 * @desc Get event statistics for a specific contract
 * @access Public
 */
router.get('/:contractId/stats', ContractEventsController.getEventStats);

/**
 * @route GET /api/events/:contractId/search
 * @desc Search events within a contract with filters
 * @access Public
 * @query {page?, limit?, query?, eventType?, ledgerFrom?, ledgerTo?}
 */
router.get('/:contractId/search', ContractEventsController.searchEvents);

/**
 * @route GET /api/events/indexer/status
 * @desc Get the status of the Soroban event indexer
 * @access Public
 */
router.get('/indexer/status', ContractEventsController.getIndexerStatus);

export default router;
