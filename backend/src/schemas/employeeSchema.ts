import { z } from 'zod';

export const createEmployeeSchema = z.object({
  organization_id: z.number().int().positive(),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  wallet_address: z.string().max(56).optional(),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional().default('active'),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ organization_id: true });

export const employeeQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  department: z.string().optional(),
  organization_id: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
