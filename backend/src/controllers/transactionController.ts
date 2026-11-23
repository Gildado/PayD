import { Request, Response } from 'express';
import { z } from 'zod';
import { TransactionAuditService } from '../services/transactionAuditService.js';
import { HttpError } from '../utils/httpError.js';
import { parseCursorQuery } from '../utils/cursorPagination.js';
import { sendProblem } from '../utils/problemDetails.js';
import { ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

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
      if (req.query.cursor !== undefined) {
        return await TransactionController.listTransactionsByCursor(req, res);
      }

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
        return sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.VALIDATION_ERROR,
          detail: 'Validation Error',
          errors: error.issues,
        });
      }
      logger.error('Error listing transactions', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /api/v1/transactions?cursor=&limit=
   * Keyset pagination ordered by created_at DESC, id DESC (issue #1807).
   * Returns `nextCursor` (null on the last page) instead of a total count.
   */
  static async listTransactionsByCursor(req: Request, res: Response) {
    try {
      const { limit, cursor } = parseCursorQuery(req.query, { defaultLimit: 10, maxLimit: 100 });
      const { sourceAccount, search, dateFrom, dateTo, successful } = transactionQuerySchema.parse(
        req.query
      );

      const page = await TransactionAuditService.listByCursor(cursor, limit, {
        sourceAccount,
        search,
        dateFrom,
        dateTo,
        successful,
      });

      res.json(page);
    } catch (error) {
      if (error instanceof HttpError) {
        return sendProblem(req, res, {
          status: error.status,
          code: error.code,
          detail: error.message,
          errors: error.details,
        });
      }
      if (error instanceof z.ZodError) {
        return sendProblem(req, res, {
          status: 400,
          code: ErrorCodes.VALIDATION_ERROR,
          detail: 'Validation Error',
          errors: error.issues,
        });
      }
      logger.error('Error listing transactions', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
