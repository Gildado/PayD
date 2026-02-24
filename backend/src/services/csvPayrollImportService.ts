import * as csv from 'fast-csv';
import { Readable } from 'stream';
import { StrKey } from '@stellar/stellar-sdk';
import { createEmployeeSchema, CreateEmployeeInput } from '../schemas/employeeSchema';
import { employeeService } from './employeeService';
import { pool } from '../config/database';
import logger from '../utils/logger';

export interface CsvRow {
    first_name: string;
    last_name: string;
    email: string;
    wallet_address?: string;
    position?: string;
    department?: string;
    base_salary?: string;
    base_currency?: string;
}

export interface ImportError {
    row: number;
    email: string;
    errors: string[];
}

export interface ImportResult {
    totalRows: number;
    successCount: number;
    errorCount: number;
    errors: ImportError[];
}

export class CsvPayrollImportService {
    async processCsv(organizationId: number, csvContent: string): Promise<ImportResult> {
        const stream = Readable.from(csvContent);
        const rows: CsvRow[] = [];

        return new Promise((resolve, reject) => {
            csv.parseStream(stream, { headers: true })
                .on('error', (error: Error) => reject(error))
                .on('data', (row: CsvRow) => rows.push(row))
                .on('end', async () => {
                    try {
                        const result = await this.validateAndStoreRows(organizationId, rows);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
        });
    }

    private async validateAndStoreRows(organizationId: number, rows: CsvRow[]): Promise<ImportResult> {
        const errors: ImportError[] = [];
        const validEmployees: CreateEmployeeInput[] = [];

        rows.forEach((row, index) => {
            const rowNum = index + 2; // +1 for 0-index, +1 for header row
            const rowErrors: string[] = [];

            // Basic structure validation
            if (!row.first_name || !row.last_name || !row.email) {
                rowErrors.push('Missing required fields: first_name, last_name, and email are mandatory');
            }

            // Wallet address validation
            if (row.wallet_address && !StrKey.isValidEd25519PublicKey(row.wallet_address)) {
                rowErrors.push('Invalid Stellar wallet address');
            }

            // Salary validation
            const salary = row.base_salary ? parseFloat(row.base_salary) : 0;
            if (row.base_salary && isNaN(salary)) {
                rowErrors.push('Invalid salary format: must be a number');
            } else if (salary < 0) {
                rowErrors.push('Salary cannot be negative');
            }

            // Zod validation for the rest
            try {
                const validated = createEmployeeSchema.parse({
                    organization_id: organizationId,
                    first_name: row.first_name,
                    last_name: row.last_name,
                    email: row.email,
                    wallet_address: row.wallet_address,
                    position: row.position,
                    department: row.department,
                    base_salary: salary,
                    base_currency: row.base_currency || 'USDC',
                    status: 'active'
                });

                if (rowErrors.length === 0) {
                    validEmployees.push(validated);
                }
            } catch (error: any) {
                if (error.errors) {
                    error.errors.forEach((err: any) => rowErrors.push(`${err.path.join('.')}: ${err.message}`));
                } else {
                    rowErrors.push(error.message);
                }
            }

            if (rowErrors.length > 0) {
                errors.push({
                    row: rowNum,
                    email: row.email || 'N/A',
                    errors: rowErrors
                });
            }
        });

        let successCount = 0;
        if (validEmployees.length > 0) {
            // Use a transaction for bulk storage
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const employee of validEmployees) {
                    await employeeService.create(employee, client);
                    successCount++;
                }
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                logger.error('Bulk import transaction failed', error);
                throw new Error('Database transaction failed during bulk import');
            } finally {
                client.release();
            }
        }

        return {
            totalRows: rows.length,
            successCount,
            errorCount: errors.length,
            errors
        };
    }
}

export const csvPayrollImportService = new CsvPayrollImportService();
