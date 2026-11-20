import { z } from 'zod';
import { SUPPORTED_ASSETS } from '../config/assets';

/**
 * Stellar StrKey-encoded values use RFC4648 base32 with a restricted
 * alphabet: A-Z and 2-7 only (0, 1, 8, 9 are never valid, since base32
 * omits characters that are easily confused when read aloud or by hand).
 * Public keys start with "G", secret keys/seeds start with "S", and both
 * are always 56 characters long.
 */
const STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;
const STELLAR_SECRET_KEY_PATTERN = /^S[A-Z2-7]{55}$/;

/** Stellar represents on-chain amounts with up to 7 decimal places of precision. */
export const STELLAR_MAX_DECIMAL_PLACES = 7;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPPORTED_ASSET_CODES = SUPPORTED_ASSETS.map((asset) => asset.code);

function decimalPlaces(value: string): number {
  const [, fraction] = value.trim().split('.');
  return fraction ? fraction.length : 0;
}

/**
 * A trimmed string that is either empty (field left blank) or matches the
 * given pattern. Mirrors the "optional unless filled in" behavior of the
 * EmployeeEntry form's wallet/secret-key fields.
 */
function optionalPatternString(pattern: RegExp, message: string) {
  return z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === '' || pattern.test(value), { message });
}

export const stellarPublicKeySchema = optionalPatternString(
  STELLAR_PUBLIC_KEY_PATTERN,
  'Invalid Stellar wallet address format'
);

export const stellarSecretKeySchema = optionalPatternString(
  STELLAR_SECRET_KEY_PATTERN,
  'Invalid Stellar secret key format (must start with S, 56 chars)'
);

/**
 * Validates a work email against format rules and, optionally, an allowed
 * list of domains. Returns the same error strings the form previously
 * produced via `validateEmailDomain`, so existing callers/tests keep working.
 */
export function checkWorkEmail(email: string, allowedDomains: readonly string[]): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Work email is required';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address';

  if (allowedDomains.length > 0) {
    const domain = trimmed.split('@')[1]?.toLowerCase();
    if (!domain || !allowedDomains.includes(domain)) {
      return `Email must be from an allowed domain: ${allowedDomains.join(', ')}`;
    }
  }

  return null;
}

/**
 * Validates a salary string against the shared Stellar decimal-precision
 * rule. Empty input is treated as "not yet set" and is valid (salary is
 * optional on this form).
 */
export function checkSalaryPrecision(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 'Salary must be a positive number';
  }
  if (decimalPlaces(trimmed) > STELLAR_MAX_DECIMAL_PLACES) {
    return `Salary supports at most ${STELLAR_MAX_DECIMAL_PLACES} decimal places`;
  }

  return null;
}

/**
 * Reusable start/end date-range check: end must be strictly after start.
 * Not currently wired to a field on the EmployeeEntry form (which has no
 * date inputs today), but exported and tested so a future contract-period
 * field can adopt it directly.
 */
export function checkDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): string | null {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Enter valid dates';
  }
  if (end.getTime() <= start.getTime()) {
    return 'End date must be after start date';
  }

  return null;
}

export interface EmployeeEntryFormValues {
  fullName: string;
  workEmail: string;
  role: string;
  walletAddress: string;
  secretKey: string;
  secretKeyConfirm: string;
  currency: string;
  salary: string;
}

/**
 * Builds the full EmployeeEntry Zod schema. `allowedEmailDomains` is a
 * parameter (rather than baked in) because it's a configurable, org-level
 * restriction (see `ALLOWED_EMAIL_DOMAINS` in EmployeeEntry.tsx).
 */
export function createEmployeeEntrySchema(allowedEmailDomains: readonly string[] = []) {
  return z
    .object({
      fullName: z
        .string()
        .transform((value) => value.trim())
        .pipe(z.string().min(1, 'Full name is required').max(100)),
      workEmail: z.string().superRefine((value, ctx) => {
        const error = checkWorkEmail(value, allowedEmailDomains);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }),
      role: z
        .string()
        .transform((value) => value.trim())
        .pipe(z.string().min(1, 'Role is required').max(100)),
      walletAddress: stellarPublicKeySchema,
      secretKey: stellarSecretKeySchema,
      secretKeyConfirm: z.string(),
      currency: z.string().refine((value) => SUPPORTED_ASSET_CODES.includes(value), {
        message: `Currency must be one of: ${SUPPORTED_ASSET_CODES.join(', ')}`,
      }),
      salary: z.string().superRefine((value, ctx) => {
        const error = checkSalaryPrecision(value);
        if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      }),
    })
    .superRefine((values, ctx) => {
      if (values.secretKey.trim() && values.secretKeyConfirm !== values.secretKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Secret keys do not match',
          path: ['secretKeyConfirm'],
        });
      }
    });
}

export type EmployeeEntrySchema = ReturnType<typeof createEmployeeEntrySchema>;
export type EmployeeEntryFormErrors = Partial<Record<keyof EmployeeEntryFormValues, string>>;

/**
 * Runs the schema and flattens issues into a `{ field: message }` map for
 * the FormField error prop. Only the first issue per field is kept, matching
 * the form's one-error-per-field display.
 */
export function validateEmployeeEntry(
  values: EmployeeEntryFormValues,
  allowedEmailDomains: readonly string[] = []
): EmployeeEntryFormErrors {
  const result = createEmployeeEntrySchema(allowedEmailDomains).safeParse(values);
  if (result.success) return {};

  const errors: EmployeeEntryFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof EmployeeEntryFormValues | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/**
 * Validates a single field on blur. Returns the field's error message, or
 * undefined if that field currently passes validation. Cross-field checks
 * (secret key confirmation) are evaluated using the full form's current
 * values so blurring the confirm field reflects the latest secret key.
 */
export function validateEmployeeEntryField(
  field: keyof EmployeeEntryFormValues,
  values: EmployeeEntryFormValues,
  allowedEmailDomains: readonly string[] = []
): string | undefined {
  return validateEmployeeEntry(values, allowedEmailDomains)[field];
}
