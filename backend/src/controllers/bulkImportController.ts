import { Request, Response } from 'express';
import {
  UnsupportedCsvEncodingError,
  csvPayrollImportService,
} from '../services/csvPayrollImportService.js';
import logger from '../utils/logger.js';

export class BulkImportController {
  async import(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId ?? Number(req.body.organization_id);
      const csvContent = req.body.csv; // Assuming the CSV is sent as a string in the 'csv' field

      if (!organizationId) {
        return res.status(400).json({ error: 'Missing organization_id' });
      }

      if (!csvContent) {
        return res.status(400).json({ error: 'Missing csv content' });
      }

      const result = await csvPayrollImportService.processCsv(organizationId, csvContent);

      // Return 207 Multi-Status if there were any errors, otherwise 200/201
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

      logger.error('Bulk Import Controller Error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown import error',
      });
    }
  }
}

export const bulkImportController = new BulkImportController();
