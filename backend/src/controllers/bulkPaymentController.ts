import { Request, Response } from 'express';
import { z } from 'zod';
import { CircuitOpenError } from '../services/circuitBreakerService.js';
import { classifyHorizonError, RetryAction } from '../services/horizonErrorClassifier.js';
import { withSpan } from '../utils/tracing.js';
import logger from '../utils/logger.js';
import { assetCodeSchema, stellarAccountSchema, paymentEntrySchema } from '../validators/paymentValidators.js';

// ---------------------------------------------------------------------------
// Validation schemas (using shared validators)
// ---------------------------------------------------------------------------

const submitBatchSchema = z.object({
  assetCode: assetCodeSchema,
  assetIssuer: stellarAccountSchema,
  payments: z
    .array(paymentEntrySchema)
    .min(1, 'payments must contain at least one entry')
    .max(100, 'payments cannot exceed 100 entries'),
});

// ---------------------------------------------------------------------------
// BulkPaymentController
// ---------------------------------------------------------------------------

export class BulkPaymentController {
  /**
   * POST /api/bulk-payments/batch
   *
   * Validates and submits a batch of Stellar payments.
   *
   * Body: { assetCode, assetIssuer, payments: [{ destination, amount }] }
   */
  static async submitBatch(req: Request, res: Response): Promise<void> {
    try {
      const body = submitBatchSchema.parse(req.body);

      await withSpan('bulk_payments.submit_batch', {
        'payd.asset_code': body.assetCode,
        'payd.bulk_payment.count': body.payments.length,
        'payd.request_id': req.id ?? '',
      }, async () => {
        // Downstream Stellar submission would be invoked here using body values.
        // The validated body is returned so callers can confirm accepted fields.
        res.status(202).json({
          success: true,
          message: 'Batch accepted for submission.',
          data: {
            assetCode: body.assetCode,
            assetIssuer: body.assetIssuer,
            paymentCount: body.payments.length,
          },
        });
      });
    } catch (error: any) {
      BulkPaymentController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // Shared error handler (now with error classification)
  // -------------------------------------------------------------------------

  private static handleError(error: any, res: Response): void {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.issues,
      });
      return;
    }

    // Stellar circuit is OPEN – fail fast with 503 (issue #1026)
    if (error instanceof CircuitOpenError || error?.name === 'CircuitOpenError') {
      res.status(503).json({
        error: 'Service Unavailable',
        detail: error.message,
        circuit: error.circuitName ?? 'stellar-api',
      });
      return;
    }

    // Classify and handle Horizon errors
    const classification = classifyHorizonError(error);
    if (classification.retriable) {
      // Retriable errors: return 202 Accepted with retry hint
      res.status(202).json({
        error: 'Submission queued for retry',
        errorType: classification.errorType,
        action: classification.action,
        maxRetries: classification.maxRetries,
        detail:
          classification.action === RetryAction.FEE_BUMP_RETRY
            ? 'Transaction will be retried with increased fees'
            : 'Transaction will be retried',
      });
      return;
    }

    // Non-retriable Horizon error
    if (error?.response?.data) {
      const extras = error.response.data?.extras;
      res.status(400).json({
        error: 'Stellar transaction error (non-retriable)',
        detail: error.response.data.title ?? error.message,
        errorType: classification.errorType,
        resultCodes: extras?.result_codes ?? null,
      });
      return;
    }

    logger.error('BulkPaymentController unhandled error', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
