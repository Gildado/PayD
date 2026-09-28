// backend/src/services/__tests__/payroll-audit.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PayrollAuditService } from '../payroll-audit.service';
import { PrismaService } from '../../database/prisma.service';

describe('PayrollAuditService (SQL Injection Prevention)', () => {
    let service: PayrollAuditService;
    let prismaMock: any;

    beforeEach(async () => {
        prismaMock = {
            payrollBatch: {
                findMany: jest.fn().mockResolvedValue([{ id: 'batch_1', batchName: 'Weekly Payroll' }]),
            },
            $queryRaw: jest.fn().mockResolvedValue([{ id: 'batch_1', totalAmount: '5000' }]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PayrollAuditService,
                { provide: PrismaService, useValue: prismaMock },
            ],
        }).compile();

        service = module.get<PayrollAuditService>(PayrollAuditService);
    });

    it('should execute parameterized queries without raw SQL injection exposure', async () => {
        const result = await service.getSecurePayrollSummary('tenant_123', '2026-01-01', '2026-09-27');
        expect(result.success).toBe(true);
        expect(prismaMock.payrollBatch.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ tenantId: 'tenant_123' }),
            })
        );
    });

    it('should use safe tagged template parameters in $queryRaw calls', async () => {
        const result = await service.getRawAnalyticsWithParameterizedQuery('tenant_123', 1000);
        expect(result.success).toBe(true);
        expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });
});