import { Request, Response } from 'express';
import { csvPayrollImportService } from '../services/csvPayrollImportService';
import logger from '../utils/logger';

export class BulkImportController {
    async import(req: Request, res: Response) {
        try {
            const { organization_id } = req.body;
            const csvContent = req.body.csv; // Assuming the CSV is sent as a string in the 'csv' field

            if (!organization_id) {
                return res.status(400).json({ error: 'Missing organization_id' });
            }

            if (!csvContent) {
                return res.status(400).json({ error: 'Missing csv content' });
            }

            const result = await csvPayrollImportService.processCsv(
                parseInt(organization_id),
                csvContent
            );

            // Return 207 Multi-Status if there were any errors, otherwise 200/201
            const statusCode = result.errorCount > 0 ? 207 : (result.successCount > 0 ? 201 : 200);

            res.status(statusCode).json({
                message: result.errorCount === 0
                    ? 'Import completed successfully'
                    : 'Import completed with some errors',
                summary: {
                    totalRows: result.totalRows,
                    successCount: result.successCount,
                    errorCount: result.errorCount,
                },
                errors: result.errors,
            });
        } catch (error: any) {
            logger.error('Bulk Import Controller Error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }
}

export const bulkImportController = new BulkImportController();
