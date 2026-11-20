// backend/src/routes/v1/payroll-secure.routes.ts
import { Router, Request, Response } from 'express';
import { requireRole, UserRole } from '../../middleware/rbac.middleware';

const router = Router();

// ADMIN & FINANCE_MANAGER only: Create payroll batch
router.post(
    '/batches',
    requireRole([UserRole.ADMIN, UserRole.FINANCE_MANAGER]),
    async (req: Request, res: Response) => {
        return res.status(201).json({
            success: true,
            data: { message: 'Payroll batch successfully created with RBAC enforcement.' },
            meta: { timestamp: new Date().toISOString() },
        });
    }
);

// ADMIN only: Disburse multi-sig mainnet funds
router.post(
    '/batches/:id/disburse',
    requireRole([UserRole.ADMIN]),
    async (req: Request, res: Response) => {
        const { id } = req.params;
        return res.json({
            success: true,
            data: { batchId: id, status: 'DISBURSED_ON_CHAIN' },
            meta: { timestamp: new Date().toISOString() },
        });
    }
);

// EMPLOYEE, FINANCE_MANAGER, ADMIN: Read own or company payroll records
router.get(
    '/records',
    requireRole([UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.EMPLOYEE]),
    async (req: Request, res: Response) => {
        return res.json({
            success: true,
            data: [{ recordId: 'rec_1001', amount: '2,500.00 XLM' }],
            meta: { timestamp: new Date().toISOString() },
        });
    }
);

export default router;