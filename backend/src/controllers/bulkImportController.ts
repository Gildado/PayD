import { Request, Response } from 'express';
import { z } from 'zod';
import {
  UnsupportedCsvEncodingError,
  csvPayrollImportService,
} from '../services/csvPayrollImportService.js';
import {
  bulkImportBodySchema,
  isCsvContentOversized,
  MAX_BULK_IMPORT_CSV_BYTES,
} from '../schemas/bulkImportSchema.js';
import { apiErrorResponse, ErrorCodes } from '../utils/apiError.js';
import logger from '../utils/logger.js';

export class BulkImportController {
  async import(req: Request, res: Response) {
    try {
      const parsed = bulkImportBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json(
            apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', parsed.error.issues)
          );
      }

      const organizationId = req.user?.organizationId ?? parsed.data.organization_id;
      const csvContent = parsed.data.csv;

      if (!organizationId) {
        return res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.BAD_REQUEST, 'Missing organization_id'));
      }

      if (isCsvContentOversized(csvContent)) {
        return res.status(413).json(
          apiErrorResponse(
            ErrorCodes.PAYLOAD_TOO_LARGE,
            `CSV content exceeds maximum size of ${MAX_BULK_IMPORT_CSV_BYTES} bytes`
          )
        );
      }

      const result = await csvPayrollImportService.processCsv(organizationId, csvContent);

      const statusCode = result.errorCount > 0 ? 207 : result.successCount > 0 ? 201 : 200;

      res.status(statusCode).json({
        message:
          result.errorCount === 0
            ? 'Import completed successfully'
            : 'Import completed with some errors',
        summary: {
          totalRows: result.totalRows,
          successCount: result.successCount,
          errorCount: result.errorCount,
        },
        errors: result.errors,
      });
    } catch (error: unknown) {
      if (error instanceof UnsupportedCsvEncodingError) {
        return res.status(400).json({
          error: 'Unsupported Encoding',
          message: error.message,
        });
      }

      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json(apiErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Validation Error', error.issues));
      }

      logger.error('Bulk Import Controller Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown import error',
      });
    }
  }
}

export const bulkImportController = new BulkImportController();
