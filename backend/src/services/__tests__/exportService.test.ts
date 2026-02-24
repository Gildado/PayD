import { ExportService } from '../exportService';
import { PayrollTransaction } from '../payroll-indexing.service';
import { PassThrough } from 'stream';

// Mock stream to capture generated data
class MockStream extends PassThrough {
    chunks: Buffer[] = [];
    constructor() {
        super();
        this.on('data', chunk => this.chunks.push(Buffer.from(chunk)));
    }

    getOutput(): string {
        return Buffer.concat(this.chunks).toString('utf8');
    }
}

describe('ExportService', () => {
    const mockTransaction: PayrollTransaction = {
        id: '1',
        sourceAccount: 'GORG123',
        employeeId: 'EMP456',
        amount: '500.00',
        assetCode: 'USDC',
        assetIssuer: 'GUSDC123',
        successful: true,
        txHash: 'hash123',
        timestamp: 1708689600, // Unix timestamp for 2026-02-23T12:00:00Z
        memo: 'February Salary',
        operationType: 'payment',
        ledgerHeight: 12345,
        fee: '100',
        signatures: [],
        isPayrollRelated: true
    };

    const mockBatch: PayrollTransaction[] = [
        mockTransaction,
        {
            ...mockTransaction,
            id: '2',
            employeeId: 'EMP457',
            amount: '750.00',
            txHash: 'hash456',
            timestamp: 1708689900,
            memo: 'February Salary Plus Bonus',
        }
    ];

    it('should generate a PDF receipt for a transaction', async () => {
        const stream = new MockStream();

        await ExportService.generateReceiptPdf(mockTransaction, stream);

        const output = stream.getOutput();
        // A PDF always starts with %PDF-
        expect(output.startsWith('%PDF-')).toBe(true);
        // Since PDF content is compressed/encoded, we might not see the raw text perfectly, but we can verify it generated without throwing
    });

    it('should generate an Excel report for a payroll batch', async () => {
        const stream = new MockStream();

        await ExportService.generatePayrollExcel('batch_1', mockBatch, stream);

        const output = stream.getOutput();
        // Excel files are zip archives, which start with PK
        expect(output.startsWith('PK')).toBe(true);
    });

    it('should generate a CSV report for a payroll batch', async () => {
        const stream = new MockStream();

        await ExportService.generatePayrollCsv(mockBatch, stream);

        const output = stream.getOutput();

        // Check if CSV headers exist
        expect(output).toContain('txHash,organizationPublicKey,employeeId,amount,assetCode,assetIssuer,status,memo,timestamp');

        // Check if the first mocked transaction data is in the output
        expect(output).toContain('hash123,GORG123,EMP456,500.00,USDC,GUSDC123,Success,February Salary,2024-02-23T12:00:00.000Z');

        // Check if the second mocked transaction data is in the output
        expect(output).toContain('hash456,GORG123,EMP457,750.00,USDC,GUSDC123,Success,February Salary Plus Bonus,2024-02-23T12:05:00.000Z');
    });
});
