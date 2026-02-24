import { Request, Response } from 'express';
import { TaxService } from '../services/taxService';

const taxService = new TaxService();

export class TaxController {
    /**
     * POST /api/taxes/rules
     * Create a new tax rule for an organization
     */
    static async createRule(req: Request, res: Response) {
        const { organization_id, name, type, value, description, priority } = req.body;

        if (!organization_id || !name || !type || value === undefined) {
            return res.status(400).json({ error: 'Missing required fields: organization_id, name, type, value' });
        }

        if (!['percentage', 'fixed'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "percentage" or "fixed"' });
        }

        if (typeof value !== 'number' || value < 0) {
            return res.status(400).json({ error: 'Value must be a non-negative number' });
        }

        try {
            const rule = await taxService.createRule({
                organization_id,
                name,
                type,
                value,
                description,
                priority,
            });

            res.status(201).json(rule);
        } catch (error: any) {
            console.error('Create tax rule error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /api/taxes/rules
     * List all tax rules for an organization
     */
    static async getRules(req: Request, res: Response) {
        const { organizationId, includeInactive } = req.query;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId query parameter is required' });
        }

        try {
            const rules = await taxService.getRules(
                Number(organizationId),
                includeInactive === 'true'
            );

            res.json({ data: rules, count: rules.length });
        } catch (error: any) {
            console.error('Get tax rules error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * PUT /api/taxes/rules/:id
     * Update an existing tax rule
     */
    static async updateRule(req: Request, res: Response) {
        const { id } = req.params;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Rule ID is required' });
        }

        if (updates.type && !['percentage', 'fixed'].includes(updates.type)) {
            return res.status(400).json({ error: 'Type must be "percentage" or "fixed"' });
        }

        if (updates.value !== undefined && (typeof updates.value !== 'number' || updates.value < 0)) {
            return res.status(400).json({ error: 'Value must be a non-negative number' });
        }

        try {
            const rule = await taxService.updateRule(Number(id), updates);

            if (!rule) {
                return res.status(404).json({ error: 'Tax rule not found' });
            }

            res.json(rule);
        } catch (error: any) {
            console.error('Update tax rule error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * DELETE /api/taxes/rules/:id
     * Soft-delete (deactivate) a tax rule
     */
    static async deleteRule(req: Request, res: Response) {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'Rule ID is required' });
        }

        try {
            const deleted = await taxService.deleteRule(Number(id));

            if (!deleted) {
                return res.status(404).json({ error: 'Tax rule not found' });
            }

            res.json({ message: 'Tax rule deactivated successfully' });
        } catch (error: any) {
            console.error('Delete tax rule error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /api/taxes/calculate
     * Calculate tax deductions for a given gross amount
     */
    static async calculateDeductions(req: Request, res: Response) {
        const { organization_id, gross_amount } = req.body;

        if (!organization_id || gross_amount === undefined) {
            return res.status(400).json({ error: 'Missing required fields: organization_id, gross_amount' });
        }

        if (typeof gross_amount !== 'number' || gross_amount < 0) {
            return res.status(400).json({ error: 'gross_amount must be a non-negative number' });
        }

        try {
            const result = await taxService.calculateDeductions(Number(organization_id), gross_amount);
            res.json(result);
        } catch (error: any) {
            console.error('Calculate deductions error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /api/taxes/reports
     * Generate a compliance tax report for an organization over a given period
     */
    static async getReport(req: Request, res: Response) {
        const { organizationId, periodStart, periodEnd } = req.query;

        if (!organizationId || !periodStart || !periodEnd) {
            return res.status(400).json({
                error: 'Required query parameters: organizationId, periodStart, periodEnd',
            });
        }

        try {
            const report = await taxService.generateReport(
                Number(organizationId),
                periodStart as string,
                periodEnd as string
            );

            res.json(report);
        } catch (error: any) {
            console.error('Generate tax report error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}
