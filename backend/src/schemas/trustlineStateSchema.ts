import { z } from 'zod';

/**
 * Schema for trustline state endpoint query parameters.
 */
export const trustlineStateQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Page must be numeric')
    .transform((v) => parseInt(v, 10))
    .refine((v) => v >= 1, 'Page must be >= 1')
    .optional()
    .default('1'),

  pageSize: z
    .string()
    .regex(/^\d+$/, 'Page size must be numeric')
    .transform((v) => parseInt(v, 10))
    .refine((v) => v >= 1 && v <= 100, 'Page size must be between 1 and 100')
    .optional()
    .default('20'),

  assetCode: z
    .string()
    .min(1, 'Asset code required if provided')
    .max(12, 'Asset code too long')
    .regex(/^[A-Z0-9]+$/, 'Asset code must be uppercase alphanumeric')
    .optional(),
});

/**
 * Individual trustline state in paginated response.
 */
export const employeeTrustlineStateSchema = z.object({
  employeeId: z.number().int().positive(),
  employeeName: z.string(),
  walletAddress: z.string().length(56),
  assetCode: z.string().max(12),
  assetIssuer: z.string().length(56),
  state: z.enum(['established', 'pending', 'missing']),
  balance: z.string().optional(),
  lastUpdated: z.string().datetime(),
});

/**
 * Pagination metadata.
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNextPage: z.boolean(),
});

/**
 * Complete paginated trustline state response.
 */
export const paginatedTrustlineStateSchema = z.object({
  employees: z.array(employeeTrustlineStateSchema),
  pagination: paginationSchema,
});

export type TrustlineStateQueryParams = z.infer<typeof trustlineStateQuerySchema>;
export type EmployeeTrustlineState = z.infer<typeof employeeTrustlineStateSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type PaginatedTrustlineState = z.infer<typeof paginatedTrustlineStateSchema>;
