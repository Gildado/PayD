// backend/src/services/payroll-audit.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PayrollAuditService {
    constructor(private readonly prisma: PrismaService) {}

    async getSecurePayrollSummary(tenantId: string, startDate: string, endDate: string) {
        // SECURITY AUDIT: Replaced vulnerable string-interpolated raw SQL with fully parameterized 
        // Prisma Client queries or typed Prisma.$queryRaw template strings preventing SQL injection.
        
        try {
            const summary = await this.prisma.payrollBatch.findMany({
                where: {
                    tenantId,
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    },
                },
                select: {
                    id: true,
                    batchName: true,
                    status: true,
                    totalAmount: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            return {
                success: true,
                count: summary.length,
                data: summary,
            };
        } catch (error: any) {
            throw new InternalServerErrorException(`Failed to fetch secure payroll summary: ${error.message}`);
        }
    }

    async getRawAnalyticsWithParameterizedQuery(tenantId: string, minAmount: number) {
        // Safe Parameterized Raw Query using Prisma template tag ($queryRaw)
        // Ensures input parameters are automatically bound as safe SQL variables instead of unescaped strings.
        const results = await this.prisma.$queryRaw`
            SELECT id, "batchName", "totalAmount", status, "createdAt"
            FROM "PayrollBatch"
            WHERE "tenantId" = ${tenantId} AND "totalAmount" >= ${minAmount}
            ORDER BY "createdAt" DESC
            LIMIT 50;
        `;

        return {
            success: true,
            data: results,
        };
    }
}