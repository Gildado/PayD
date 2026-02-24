import { Pool } from 'pg';
import pool from '../config/database';

export interface TaxRule {
    id: number;
    organization_id: number;
    name: string;
    type: 'percentage' | 'fixed';
    value: number;
    description: string | null;
    is_active: boolean;
    priority: number;
    created_at: Date;
    updated_at: Date;
}

export interface CreateTaxRuleInput {
    organization_id: number;
    name: string;
    type: 'percentage' | 'fixed';
    value: number;
    description?: string;
    priority?: number;
}

export interface UpdateTaxRuleInput {
    name?: string;
    type?: 'percentage' | 'fixed';
    value?: number;
    description?: string;
    is_active?: boolean;
    priority?: number;
}

export interface TaxDeduction {
    rule_id: number;
    rule_name: string;
    type: 'percentage' | 'fixed';
    rule_value: number;
    deducted_amount: number;
}

export interface DeductionResult {
    gross_amount: number;
    deductions: TaxDeduction[];
    total_tax: number;
    net_amount: number;
}

export interface TaxReportEntry {
    rule_name: string;
    rule_type: string;
    rule_value: number;
    total_gross: number;
    total_tax: number;
    total_net: number;
    transaction_count: number;
}

export interface TaxReport {
    organization_id: number;
    period_start: string;
    period_end: string;
    entries: TaxReportEntry[];
    summary: {
        total_gross: number;
        total_tax: number;
        total_net: number;
    };
}

export class TaxService {
    private pool: Pool;

    constructor(poolInstance: Pool = pool) {
        this.pool = poolInstance;
    }

    /**
     * Create a new tax rule for an organization
     */
    async createRule(input: CreateTaxRuleInput): Promise<TaxRule> {
        const { organization_id, name, type, value, description, priority } = input;

        const result = await this.pool.query(
            `INSERT INTO tax_rules (organization_id, name, type, value, description, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [organization_id, name, type, value, description || null, priority ?? 0]
        );

        return result.rows[0];
    }

    /**
     * Retrieve all active tax rules for an organization, ordered by priority
     */
    async getRules(organizationId: number, includeInactive = false): Promise<TaxRule[]> {
        const activeClause = includeInactive ? '' : 'AND is_active = TRUE';

        const result = await this.pool.query(
            `SELECT * FROM tax_rules
       WHERE organization_id = $1 ${activeClause}
       ORDER BY priority ASC, created_at ASC`,
            [organizationId]
        );

        return result.rows;
    }

    /**
     * Update an existing tax rule
     */
    async updateRule(ruleId: number, updates: UpdateTaxRuleInput): Promise<TaxRule | null> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            values.push(updates.name);
        }
        if (updates.type !== undefined) {
            fields.push(`type = $${paramIndex++}`);
            values.push(updates.type);
        }
        if (updates.value !== undefined) {
            fields.push(`value = $${paramIndex++}`);
            values.push(updates.value);
        }
        if (updates.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }
        if (updates.is_active !== undefined) {
            fields.push(`is_active = $${paramIndex++}`);
            values.push(updates.is_active);
        }
        if (updates.priority !== undefined) {
            fields.push(`priority = $${paramIndex++}`);
            values.push(updates.priority);
        }

        if (fields.length === 0) return null;

        values.push(ruleId);

        const result = await this.pool.query(
            `UPDATE tax_rules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        return result.rows[0] || null;
    }

    /**
     * Soft-delete a tax rule by deactivating it
     */
    async deleteRule(ruleId: number): Promise<boolean> {
        const result = await this.pool.query(
            `UPDATE tax_rules SET is_active = FALSE WHERE id = $1 RETURNING id`,
            [ruleId]
        );

        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * Calculate all tax deductions for a given gross amount using an organization's active rules.
     * Rules are applied in priority order (ascending).
     */
    async calculateDeductions(organizationId: number, grossAmount: number): Promise<DeductionResult> {
        const rules = await this.getRules(organizationId);
        const deductions: TaxDeduction[] = [];
        let totalTax = 0;

        for (const rule of rules) {
            let deductedAmount = 0;

            if (rule.type === 'percentage') {
                deductedAmount = parseFloat((grossAmount * (Number(rule.value) / 100)).toFixed(7));
            } else if (rule.type === 'fixed') {
                deductedAmount = parseFloat(Number(rule.value).toFixed(7));
            }

            deductions.push({
                rule_id: rule.id,
                rule_name: rule.name,
                type: rule.type,
                rule_value: Number(rule.value),
                deducted_amount: deductedAmount,
            });

            totalTax += deductedAmount;
        }

        const netAmount = parseFloat((grossAmount - totalTax).toFixed(7));

        return {
            gross_amount: grossAmount,
            deductions,
            total_tax: parseFloat(totalTax.toFixed(7)),
            net_amount: Math.max(0, netAmount),
        };
    }

    /**
     * Record a tax deduction in the tax_reports table
     */
    async recordDeduction(
        organizationId: number,
        employeeId: number | null,
        transactionId: number | null,
        taxRuleId: number,
        grossAmount: number,
        taxAmount: number,
        netAmount: number,
        periodStart?: string,
        periodEnd?: string
    ): Promise<void> {
        await this.pool.query(
            `INSERT INTO tax_reports
       (organization_id, employee_id, transaction_id, tax_rule_id, gross_amount, tax_amount, net_amount, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [organizationId, employeeId, transactionId, taxRuleId, grossAmount, taxAmount, netAmount, periodStart || null, periodEnd || null]
        );
    }

    /**
     * Generate a compliance tax report for an organization over a given period
     */
    async generateReport(
        organizationId: number,
        periodStart: string,
        periodEnd: string
    ): Promise<TaxReport> {
        const result = await this.pool.query(
            `SELECT
         tr.name AS rule_name,
         tr.type AS rule_type,
         tr.value AS rule_value,
         COALESCE(SUM(trp.gross_amount), 0) AS total_gross,
         COALESCE(SUM(trp.tax_amount), 0) AS total_tax,
         COALESCE(SUM(trp.net_amount), 0) AS total_net,
         COUNT(trp.id) AS transaction_count
       FROM tax_rules tr
       LEFT JOIN tax_reports trp
         ON tr.id = trp.tax_rule_id
         AND trp.generated_at >= $2
         AND trp.generated_at <= $3
       WHERE tr.organization_id = $1
       GROUP BY tr.id, tr.name, tr.type, tr.value
       ORDER BY tr.priority ASC`,
            [organizationId, periodStart, periodEnd]
        );

        const entries: TaxReportEntry[] = result.rows.map((row: any) => ({
            rule_name: row.rule_name,
            rule_type: row.rule_type,
            rule_value: parseFloat(row.rule_value),
            total_gross: parseFloat(row.total_gross),
            total_tax: parseFloat(row.total_tax),
            total_net: parseFloat(row.total_net),
            transaction_count: parseInt(row.transaction_count, 10),
        }));

        const summary = entries.reduce(
            (acc, entry) => ({
                total_gross: acc.total_gross + entry.total_gross,
                total_tax: acc.total_tax + entry.total_tax,
                total_net: acc.total_net + entry.total_net,
            }),
            { total_gross: 0, total_tax: 0, total_net: 0 }
        );

        return {
            organization_id: organizationId,
            period_start: periodStart,
            period_end: periodEnd,
            entries,
            summary,
        };
    }
}

export default new TaxService();
