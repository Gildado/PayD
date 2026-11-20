import { z } from 'zod';

const STELLAR_PUBLIC_KEY = z
  .string()
  .min(56, 'Stellar public key must be at least 56 characters')
  .max(56, 'Stellar public key must be at most 56 characters')
  .regex(/^G[A-Z0-9]{55}$/, 'Invalid Stellar public key format');

const STELLAR_SECRET_KEY = z
  .string()
  .min(56, 'Stellar secret key must be at least 56 characters')
  .max(56, 'Stellar secret key must be at most 56 characters')
  .regex(/^S[A-Z0-9]{55}$/, 'Invalid Stellar secret key format');

export const registerSchema = z.object({
  walletAddress: STELLAR_PUBLIC_KEY,
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organizationName: z.string().min(1, 'Organization name is required').max(255),
});

export const loginSchema = z.object({
  walletAddress: STELLAR_PUBLIC_KEY.optional(),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(1, 'Password is required').optional(),
  inviteToken: z.string().optional(),
  captchaToken: z.string().optional(),
}).refine(
  (data) => data.walletAddress || data.email,
  { message: 'Either walletAddress or email is required' }
);

export const refreshSchema = z.object({
  token: z.string().min(1, 'Refresh token is required'),
});

export const updateOrgNameSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  twoFactorToken: z.string().optional(),
});

export const updateOrgIssuerSchema = z.object({
  issuerAccount: STELLAR_PUBLIC_KEY,
  twoFactorToken: z.string().optional(),
});

export const createScheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required').max(255),
  frequency: z.enum(['weekly', 'biweekly', 'monthly'], {
    errorMap: () => ({ message: 'Frequency must be weekly, biweekly, or monthly' }),
  }),
  timezone: z.string().optional(),
  asset_code: z.string().min(1).max(12).optional(),
});

export const updateScheduleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  timezone: z.string().optional(),
  asset_code: z.string().min(1).max(12).optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export const createClaimSchema = z.object({
  employee_id: z.number().int().positive().optional(),
  payroll_run_id: z.number().int().positive().optional(),
  payroll_item_id: z.number().int().positive().optional(),
  claimant_public_key: STELLAR_PUBLIC_KEY,
  amount: z.string().min(1, 'Amount is required'),
  asset_code: z.string().min(1, 'Asset code is required').max(12),
  asset_issuer: STELLAR_PUBLIC_KEY.optional(),
  sponsor_secret: STELLAR_SECRET_KEY,
  claim_instructions: z.string().optional(),
  expires_in_days: z.number().int().positive().optional(),
});

export const freezeAccountSchema = z.object({
  targetAccount: STELLAR_PUBLIC_KEY,
  assetCode: z.string().min(1, 'Asset code is required').max(12),
  assetIssuer: STELLAR_PUBLIC_KEY,
});

export const freezeGlobalSchema = z.object({
  assetCode: z.string().min(1, 'Asset code is required').max(12),
  assetIssuer: STELLAR_PUBLIC_KEY,
});

export const claimQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const scheduleParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
