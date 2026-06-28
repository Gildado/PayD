import { Router } from 'express';
import { BulkPaymentController } from '../controllers/bulkPaymentController.js';

const router = Router();

/**
 * POST /api/bulk-payments/batch
 *
 * Submit a batch of Stellar payments. `assetCode` is validated before the
 * batch is forwarded to the Stellar submission path.
 */
router.post('/batch', BulkPaymentController.submitBatch);

export default router;
