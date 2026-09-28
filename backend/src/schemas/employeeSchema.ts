import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .optional();

export const EMPLOYEE_DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Operations',
  'Finance',
  'Human Resources',
  'Customer Support',
  'Legal',
  'IT',
] as const;

export const EMPLOYEE_POSITIONS = [
  'Software Engineer',
  'Senior Software Engineer',
  'DevOps Engineer',
  'QA Engineer',
  'Engineering Manager',
  'Developer',
  'Lead Developer',
  'Engineer',
  'Product Manager',
  'Project Manager',
  'UX Designer',
  'UI Designer',
  'Designer',
  'HR Specialist',
  'HR Manager',
  'Finance Operations Specialist',
  'Accountant',
  'Payroll Specialist',
  'Sales Representative',
  'Sales Manager',
  'Customer Support Specialist',
  'Operations Specialist',
  'Operations Manager',
  'Marketing Specialist',
  'Marketing Manager',
  'Data Analyst',
  'Business Analyst',
  'Manager',
  'Intern',
] as const;

const allowedDepartmentSet = new Set<string>(EMPLOYEE_DEPARTMENTS);
const allowedPositionSet = new Set<string>(EMPLOYEE_POSITIONS);

const optionalAllowedString = (
  fieldName: string,
  allowedValues: readonly string[],
  allowedSet: ReadonlySet<string>
) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .trim()
      .max(100)
      .refine((value) => allowedSet.has(value), {
        message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      })
      .optional()
  );

export const createEmployeeSchema = z.object({
  organization_id: z.number().int().positive(),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  wallet_address: z
    .string()
    .max(56)
    .refine((value) => StrKey.isValidEd25519PublicKey(value), {
      message: 'Invalid Stellar wallet address',
    })
    .optional(),
  position: optionalAllowedString('Position', EMPLOYEE_POSITIONS, allowedPositionSet),
  department: optionalAllowedString('Department', EMPLOYEE_DEPARTMENTS, allowedDepartmentSet),
  status: z.enum(['active', 'inactive', 'pending']).optional().default('active'),
  base_salary: z.number().nonnegative().optional().default(0),
  base_currency: z.string().max(12).optional().default('USDC'),

  // Profile: contact information
  phone: z.string().max(20).optional(),
  address_line1: z.string().max(255).optional(),
  address_line2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state_province: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(100).optional(),

  // Profile: employment details
  job_title: z.string().max(100).optional(),
  hire_date: dateStringSchema,
  date_of_birth: dateStringSchema,

  // Profile: emergency contact
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z.string().max(20).optional(),

  // Profile: withdrawal preferences (anchor integration)
  withdrawal_preference: z.enum(['bank', 'mobile_money', 'crypto']).optional().default('bank'),
  bank_name: z.string().max(100).optional(),
  bank_account_number: z.string().max(50).optional(),
  bank_routing_number: z.string().max(50).optional(),
  mobile_money_provider: z.string().max(50).optional(),
  mobile_money_account: z.string().max(50).optional(),

  // Profile: notes
  notes: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ organization_id: true });

export const EMPLOYEE_LIST_MAX_LIMIT = 100;

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(EMPLOYEE_LIST_MAX_LIMIT)
    .optional()
    .default(10),
  q: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  department: z.string().optional(),
  organization_id: z.string().regex(/^\d+$/).transform(Number).optional(),
  hire_date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  hire_date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  withdrawal_preference: z.enum(['bank', 'mobile_money', 'crypto']).optional(),
  salary_min: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .optional(),
  salary_max: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .optional(),
  sort_by: z
    .enum(['created_at', 'first_name', 'last_name', 'email', 'hire_date', 'base_salary'])
    .optional()
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQueryInput = z.infer<typeof employeeQuerySchema>;
