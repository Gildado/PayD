import { Request, Response } from 'express';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

/**
 * Stellar asset codes are 1–12 uppercase alphanumeric characters.
 * Reference: https://developers.stellar.org/docs/issuing-assets/anatomy-of-an-asset
 */
const assetCodeSchema = z
  .string()
  .min(1, 'assetCode must be at least 1 character')
  .max(12, 'assetCode must be at most 12 characters')
  .regex(/^[A-Z0-9]+$/, 'assetCode must be uppercase alphanumeric');

const batchPaymentEntrySchema = z.object({
  destination: z
    .string()
    .length(56, 'destination must be a 56-character Stellar public key'),
  amount: z.string().min(1, 'amount is required'),
});

const submitBatchSchema = z.object({
  assetCode: assetCodeSchema,
  assetIssuer: z
    .string()
    .length(56, 'assetIssuer must be a 56-character Stellar public key'),
  payments: z
    .array(batchPaymentEntrySchema)
    .min(1, 'payments must contain at least one entry'),
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
    } catch (error: any) {
      BulkPaymentController.handleError(error, res);
    }
  }

  // -------------------------------------------------------------------------
  // Shared error handler
  // -------------------------------------------------------------------------

  private static handleError(error: any, res: Response): void {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.issues,
      });
      return;
    }

    // Horizon submission failure
    if (error?.response?.data) {
      const extras = error.response.data?.extras;
      res.status(502).json({
        error: 'Stellar network error',
        detail: error.response.data.title ?? error.message,
        resultCodes: extras?.result_codes ?? null,
      });
      return;
    }

    console.error('BulkPaymentController unhandled error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
