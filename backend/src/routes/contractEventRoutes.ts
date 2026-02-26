import { Router } from 'express';
import { ContractEventsController } from '../controllers/contractEventsController';

const router = Router();

/**
 * GET /api/events/:contractId?page=1&limit=20&eventType=...
 */
router.get('/:contractId', ContractEventsController.listByContract);

export default router;
