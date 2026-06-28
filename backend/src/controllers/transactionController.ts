import { Request, Response } from 'express';
import { z } from 'zod';
import { TransactionAuditService } from '../services/transactionAuditService.js';

const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sourceAccount: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  successful: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export class TransactionController {
  /**
   * GET /api/v1/transactions
   * List transactions with pagination.
   */
  static async listTransactions(req: Request, res: Response) {
    try {
      const { page, limit, sourceAccount, search, dateFrom, dateTo, successful } =
        transactionQuerySchema.parse(req.query);

      const result = await TransactionAuditService.list(page, limit, {
        sourceAccount,
        search,
        dateFrom,
        dateTo,
        successful,
      });

      res.json({
        data: result.data,
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: error.issues });
      }
      console.error(`[${req.requestId || (req as any).id}] Error listing transactions:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
