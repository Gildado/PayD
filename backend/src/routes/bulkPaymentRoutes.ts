import { Router } from 'express';
import { BulkPaymentController } from '../controllers/bulkPaymentController.js';
import { circuitBreakerGuard } from '../middlewares/circuitBreakerMiddleware.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';

const router = Router();

/**
 * POST /api/bulk-payments/batch
 *
 * Submit a batch of Stellar payments. `assetCode` is validated before the
 * batch is forwarded to the Stellar submission path.
 *
 * - `circuitBreakerGuard('stellar-api')` fails fast with 503 when the
 *   Stellar SDK circuit is OPEN (issue #1026)
 * - `idempotencyMiddleware` requires a UUID v4 `Idempotency-Key` header so
 *   client retries never double-submit a batch (issue #1025)
 */
router.post(
  '/batch',
  idempotencyMiddleware,
  circuitBreakerGuard('stellar-api'),
  BulkPaymentController.submitBatch,
);

export default router;
