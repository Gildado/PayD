// backend/src/validators/payroll.validator.ts
import { z } from 'zod';

export const createPayrollBatchSchema = z.object({
    batchName: z.string().min(3, 'Batch name must be at least 3 characters').max(100),
    tokenContractId: z.string().regex(/^C[A-Z2-7]{55}$/, 'Invalid Stellar Asset Contract ID format'),
    recipients: z.array(
        z.object({
            walletAddress: z.string().regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar public key format'),
            amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid numeric string'),
            employeeId: z.string().uuid('Invalid employee ID format'),
        })
    ).min(1, 'Payroll batch must contain at least one recipient'),
    scheduledDate: z.string().datetime('Invalid ISO datetime string format').optional(),
});

export const updatePayrollStatusSchema = z.object({
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
    txHash: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid transaction hash format').optional(),
});

export type CreatePayrollBatchDto = z.infer<typeof createPayrollBatchSchema>;
export type UpdatePayrollStatusDto = z.infer<typeof updatePayrollStatusSchema>;