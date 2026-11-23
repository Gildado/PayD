import { Request, Response } from 'express';
import { z } from 'zod';
import { TaxService } from '../services/taxService.js';
import logger from '../utils/logger.js';

const taxService = new TaxService();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal server error';
}

function validationError(res: Response, error: z.ZodError): Response {
  return res.status(400).json({ error: error.issues[0]?.message ?? 'Validation error' });
}

function bodyRecord(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object'
    ? (req.body as Record<string, unknown>)
    : {};
}

/**
 * EMPLOYER accounts may only read and mutate tax data belonging to their own
 * organization. Routes enforce the role; this keeps the organization scope
 * tight for endpoints that accept an explicit organization id.
 */
function organizationMismatch(req: Request, requestedOrganizationId: number): boolean {
  const userOrganizationId = req.user?.organizationId;
  return userOrganizationId != null && userOrganizationId !== requestedOrganizationId;
}

export class TaxController {
  /**
   * POST /api/taxes/rules
   * Create a new tax rule for an organization
   */
  static async createRule(req: Request, res: Response) {
    const body = bodyRecord(req);
    if (!body.organization_id || !body.name || !body.type || body.value === undefined) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: organization_id, name, type, value' });
    }

    const parsed = createTaxRuleSchema.safeParse(body);
    if (!parsed.success) return validationError(res, parsed.error);

    const dto = parsed.data;
    if (organizationMismatch(req, dto.organization_id)) {
      return res.status(403).json({ error: 'Access denied: Organization mismatch' });
    }

    try {
      const rule = await taxService.createRule(dto);
      res.status(201).json(rule);
    } catch (error: any) {
      logger.error('Failed to create tax rule', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/taxes/rules
   * List all tax rules for an organization
   */
  static async getRules(req: Request, res: Response) {
    if (!req.query.organizationId) {
      return res.status(400).json({ error: 'organizationId query parameter is required' });
    }

    const parsed = listTaxRulesQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);

    const { organizationId, includeInactive } = parsed.data;
    if (organizationMismatch(req, organizationId)) {
      return res.status(403).json({ error: 'Access denied: Organization mismatch' });
    }

    try {
      const rules = await taxService.getRules(organizationId, includeInactive === 'true');
      res.json({ data: rules, count: rules.length });
    } catch (error: any) {
      logger.error('Failed to get tax rules', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/taxes/rules/:id
   * Update an existing tax rule
   */
  static async updateRule(req: Request, res: Response) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Rule ID is required' });
    }

    const parsed = updateTaxRuleSchema.safeParse(bodyRecord(req));
    if (!parsed.success) return validationError(res, parsed.error);
    const updates = parsed.data;

    try {
      // When type is changing, validate that the effective value is legal for
      // the new type. If value is not in this request, read the existing rule.
      if (updates.type) {
        let effectiveValue: number | undefined = updates.value;
        if (effectiveValue === undefined) {
          const current = await taxService.getRuleById(Number(id));
          if (!current) {
            return res.status(404).json({ error: 'Tax rule not found' });
          }
          effectiveValue = current.value;
        }
        if (updates.type === 'percentage' && effectiveValue > 100) {
          return res.status(400).json({
            error: `Value ${effectiveValue} is not valid for type "percentage". Percentage value must be between 0 and 100.`,
          });
        }
      }

      const rule = await taxService.updateRule(Number(id), updates);
      if (!rule) {
        return res.status(404).json({ error: 'Tax rule not found' });
      }

      res.json(rule);
    } catch (error: any) {
      logger.error('Failed to update tax rule', error);
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
      logger.error('Failed to delete tax rule', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/taxes/calculate
   * Calculate tax deductions for a given gross amount
   */
  static async calculateDeductions(req: Request, res: Response) {
    const body = bodyRecord(req);
    if (!body.organization_id || body.gross_amount === undefined) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: organization_id, gross_amount' });
    }

    const parsed = calculateDeductionsSchema.safeParse(body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { organization_id, gross_amount } = parsed.data;
    if (organizationMismatch(req, organization_id)) {
      return res.status(403).json({ error: 'Access denied: Organization mismatch' });
    }

    try {
      const result = await taxService.calculateDeductions(organization_id, gross_amount);
      res.json(result);
    } catch (error: any) {
      logger.error('Failed to calculate deductions', error);
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

    const parsed = taxReportQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);

    const reportQuery = parsed.data;
    if (organizationMismatch(req, reportQuery.organizationId)) {
      return res.status(403).json({ error: 'Access denied: Organization mismatch' });
    }

    try {
      const report = await taxService.generateReport(
        reportQuery.organizationId,
        reportQuery.periodStart,
        reportQuery.periodEnd
      );
      res.json(report);
    } catch (error: any) {
      logger.error('Failed to generate tax report', error);
      res.status(500).json({ error: error.message });
    }
  }
}
