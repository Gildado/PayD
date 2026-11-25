import { z } from 'zod';

/** POST /api/taxes/rules */
export const createTaxRuleSchema = z
  .object({
    organization_id: z.coerce.number().int().positive(),
    name: z.string().min(1),
    type: z
      .string()
      .refine((value): value is 'percentage' | 'fixed' => value === 'percentage' || value === 'fixed', {
        message: 'Type must be "percentage" or "fixed"',
      }),
    value: z
      .number({ message: 'Value must be a non-negative number' })
      .nonnegative('Value must be a non-negative number'),
    description: z.string().optional(),
    priority: z.number().optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.type === 'percentage' && rule.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentage value must be between 0 and 100',
      });
    }
  });

export type CreateTaxRuleDto = z.infer<typeof createTaxRuleSchema>;

/** PUT /api/taxes/rules/:id */
export const updateTaxRuleSchema = z.object({
  name: z.string().optional(),
  type: z
    .string()
    .refine((value): value is 'percentage' | 'fixed' => value === 'percentage' || value === 'fixed', {
      message: 'Type must be "percentage" or "fixed"',
    })
    .optional(),
  value: z
    .number({ message: 'Value must be a non-negative number' })
    .nonnegative('Value must be a non-negative number')
    .optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  priority: z.number().optional(),
});

export type UpdateTaxRuleDto = z.infer<typeof updateTaxRuleSchema>;

/** GET /api/taxes/rules */
export const listTaxRulesQuerySchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

export type ListTaxRulesQueryDto = z.infer<typeof listTaxRulesQuerySchema>;

/** POST /api/taxes/calculate */
export const calculateDeductionsSchema = z.object({
  organization_id: z.coerce.number().int().positive(),
  gross_amount: z
    .number({ message: 'gross_amount must be a non-negative number' })
    .nonnegative('gross_amount must be a non-negative number'),
});

export type CalculateDeductionsDto = z.infer<typeof calculateDeductionsSchema>;

/** GET /api/taxes/reports */
export const taxReportQuerySchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export type TaxReportQueryDto = z.infer<typeof taxReportQuerySchema>;
