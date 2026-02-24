import { Router } from 'express';
import { ExportController } from '../controllers/exportController';

const router = Router();

// GET /api/v1/exports/receipt/:txHash/pdf
router.get('/receipt/:txHash/pdf', ExportController.getReceiptPdf);

// GET /api/v1/exports/payroll/:organizationPublicKey/:batchId/excel
router.get('/payroll/:organizationPublicKey/:batchId/excel', ExportController.getPayrollExcel);

// GET /api/v1/exports/payroll/:organizationPublicKey/:batchId/csv
router.get('/payroll/:organizationPublicKey/:batchId/csv', ExportController.getPayrollCsv);

export default router;
