import { csvPayrollImportService } from '../csvPayrollImportService';
import { pool } from '../../config/database';
import { employeeService } from '../employeeService';

// Mock database pool
jest.mock('../../config/database', () => ({
    pool: {
        connect: jest.fn(),
        query: jest.fn(),
    },
}));

// Mock employee service
jest.mock('../employeeService', () => ({
    employeeService: {
        create: jest.fn(),
    },
}));

describe('CsvPayrollImportService', () => {
    const mockOrganizationId = 1;
    const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    });

    it('should process a valid CSV correctly', async () => {
        const csvContent =
            `first_name,last_name,email,wallet_address,base_salary,base_currency
John,Doe,john@example.com,GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6,5000,USDC
Jane,Smith,jane@example.com,GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6,3000,XLM`;

        const result = await csvPayrollImportService.processCsv(mockOrganizationId, csvContent);

        expect(result.totalRows).toBe(2);
        expect(result.successCount).toBe(2);
        expect(result.errorCount).toBe(0);
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
        expect(employeeService.create).toHaveBeenCalledTimes(2);
    });

    it('should report errors for invalid rows', async () => {
        const csvContent =
            `first_name,last_name,email,wallet_address,base_salary,base_currency
John,Doe,john@example.com,INVALID_WALLET,5000,USDC
Jane,,jane@example.com,GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6,-100,XLM`;

        const result = await csvPayrollImportService.processCsv(mockOrganizationId, csvContent);

        expect(result.totalRows).toBe(2);
        expect(result.successCount).toBe(0);
        expect(result.errorCount).toBe(2);

        expect(result.errors[0].errors).toContain('Invalid Stellar wallet address');
        expect(result.errors[1].errors).toContain('Missing required fields: first_name, last_name, and email are mandatory');
        expect(result.errors[1].errors).toContain('Salary cannot be negative');
    });

    it('should handle partial success within a transaction', async () => {
        const csvContent =
            `first_name,last_name,email,wallet_address,base_salary,base_currency
John,Doe,john@example.com,GDUKMGUGKAAZBAMNSMUA4Y6G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXT2U2D6,5000,USDC
Jane,Smith,jane@example.com,INVALID_WALLET,3000,XLM`;

        const result = await csvPayrollImportService.processCsv(mockOrganizationId, csvContent);

        expect(result.totalRows).toBe(2);
        expect(result.successCount).toBe(1);
        expect(result.errorCount).toBe(1);
        expect(employeeService.create).toHaveBeenCalledTimes(1);
    });

    it('should rollback on database error', async () => {
        const csvContent = `first_name,last_name,email\nJohn,Doe,john@example.com`;
        (employeeService.create as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

        await expect(csvPayrollImportService.processCsv(mockOrganizationId, csvContent))
            .rejects.toThrow('Database transaction failed during bulk import');

        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
});
