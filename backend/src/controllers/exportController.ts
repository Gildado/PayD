import { Request, Response } from 'express';
import { ExportService } from '../services/exportService';
import { payrollQueryService } from '../services/payroll-query.service';
import logger from '../utils/logger';

export class ExportController {
    /**
     * Generates and streams a PDF receipt for a specific transaction.
     */
    static async getReceiptPdf(req: Request, res: Response): Promise<void> {
        try {
            const { txHash } = req.params;

            const transaction = await payrollQueryService.getTransactionDetails(txHash);
            if (!transaction) {
                res.status(404).json({ success: false, error: 'Transaction not found' });
                return;
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="receipt-${txHash.substring(0, 8)}.pdf"`);

            await ExportService.generateReceiptPdf(transaction, res);
        } catch (error) {
            logger.error('Failed to generate PDF receipt', { error });

            // If headers are already sent, we can't send a JSON response.
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Internal server error during PDF generation' });
            } else {
                res.end();
            }
        }
    }

    /**
     * Generates and streams an Excel report for a payroll batch.
     */
    static async getPayrollExcel(req: Request, res: Response): Promise<void> {
        try {
            const { organizationPublicKey, batchId } = req.params;

            // We would likely fetch all or a large chunk of transactions for the batch.
            // Assuming getPayrollBatch returns a paginated result, we might need a way to fetch all,
            // but for this implementation, we'll fetch the first massive page or assume limit handles it.
            const batchData = await payrollQueryService.getPayrollBatch(organizationPublicKey, batchId, 1, 100000);

            if (!batchData || batchData.data.length === 0) {
                res.status(404).json({ success: false, error: 'Batch not found or empty' });
                return;
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="payroll-batch-${batchId}.xlsx"`);

            await ExportService.generatePayrollExcel(batchId, batchData.data, res);
        } catch (error) {
            logger.error('Failed to generate Excel report', { error });

            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Internal server error during Excel generation' });
            } else {
                res.end();
            }
        }
    }

    /**
     * Generates and streams a CSV report for a payroll batch.
     */
    static async getPayrollCsv(req: Request, res: Response): Promise<void> {
        try {
            const { organizationPublicKey, batchId } = req.params;

            const batchData = await payrollQueryService.getPayrollBatch(organizationPublicKey, batchId, 1, 100000);

            if (!batchData || batchData.data.length === 0) {
                res.status(404).json({ success: false, error: 'Batch not found or empty' });
                return;
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="payroll-batch-${batchId}.csv"`);

            await ExportService.generatePayrollCsv(batchData.data, res);
        } catch (error) {
            logger.error('Failed to generate CSV report', { error });

            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Internal server error during CSV generation' });
            } else {
                res.end();
            }
        }
    }
}
