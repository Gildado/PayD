import { describe, expect, it } from 'vitest';
import {
  checkDateRange,
  checkSalaryPrecision,
  checkWorkEmail,
  createEmployeeEntrySchema,
  stellarPublicKeySchema,
  stellarSecretKeySchema,
  validateEmployeeEntry,
  validateEmployeeEntryField,
  type EmployeeEntryFormValues,
} from '../employeeEntrySchema';

const VALID_PUBLIC_KEY = 'G' + 'B'.repeat(55);
const VALID_SECRET_KEY = 'S' + 'A'.repeat(55);

function baseValues(overrides: Partial<EmployeeEntryFormValues> = {}): EmployeeEntryFormValues {
  return {
    fullName: 'Jane Smith',
    workEmail: 'jane.smith@example.com',
    role: 'Contractor',
    walletAddress: '',
    secretKey: '',
    secretKeyConfirm: '',
    currency: 'USDC',
    salary: '2500',
    ...overrides,
  };
}

describe('stellarPublicKeySchema', () => {
  it('accepts an empty string (optional field)', () => {
    expect(stellarPublicKeySchema.safeParse('').success).toBe(true);
  });

  it('accepts a well-formed G-prefixed 56-char key', () => {
    expect(stellarPublicKeySchema.safeParse(VALID_PUBLIC_KEY).success).toBe(true);
  });

  it('rejects keys not starting with G', () => {
    const result = stellarPublicKeySchema.safeParse('A' + 'B'.repeat(55));
    expect(result.success).toBe(false);
  });

  it('rejects keys of the wrong length', () => {
    expect(stellarPublicKeySchema.safeParse('GBTOO' + 'A'.repeat(20)).success).toBe(false);
    expect(stellarPublicKeySchema.safeParse('G' + 'B'.repeat(60)).success).toBe(false);
  });

  it('rejects characters outside the base32 alphabet (0, 1, 8, 9)', () => {
    expect(stellarPublicKeySchema.safeParse('G0' + 'B'.repeat(54)).success).toBe(false);
    expect(stellarPublicKeySchema.safeParse('G1' + 'B'.repeat(54)).success).toBe(false);
    expect(stellarPublicKeySchema.safeParse('G8' + 'B'.repeat(54)).success).toBe(false);
    expect(stellarPublicKeySchema.safeParse('G9' + 'B'.repeat(54)).success).toBe(false);
  });
});

describe('stellarSecretKeySchema', () => {
  it('accepts an empty string (optional field)', () => {
    expect(stellarSecretKeySchema.safeParse('').success).toBe(true);
  });

  it('accepts a well-formed S-prefixed 56-char key', () => {
    expect(stellarSecretKeySchema.safeParse(VALID_SECRET_KEY).success).toBe(true);
  });

  it('rejects keys not starting with S', () => {
    expect(stellarSecretKeySchema.safeParse('G' + 'A'.repeat(55)).success).toBe(false);
  });

  it('rejects keys of the wrong length', () => {
    expect(stellarSecretKeySchema.safeParse('SA').success).toBe(false);
  });
});

describe('checkWorkEmail', () => {
  it('returns an error for an empty email', () => {
    expect(checkWorkEmail('', [])).toBe('Work email is required');
  });

  it('returns an error for a malformed email', () => {
    expect(checkWorkEmail('not-an-email', [])).toBe('Enter a valid email address');
  });

  it('accepts any domain when the allow-list is empty', () => {
    expect(checkWorkEmail('test@gmail.com', [])).toBeNull();
  });

  it('accepts an email matching an allowed domain', () => {
    expect(checkWorkEmail('user@company.com', ['company.com', 'org.co'])).toBeNull();
  });

  it('rejects an email outside the allowed domains', () => {
    const result = checkWorkEmail('user@gmail.com', ['company.com']);
    expect(result).toContain('allowed domain');
    expect(result).toContain('company.com');
  });
});

describe('checkSalaryPrecision', () => {
  it('treats an empty salary as valid (optional field)', () => {
    expect(checkSalaryPrecision('')).toBeNull();
  });

  it('accepts a whole-number salary', () => {
    expect(checkSalaryPrecision('2500')).toBeNull();
  });

  it('accepts up to 7 decimal places', () => {
    expect(checkSalaryPrecision('2500.1234567')).toBeNull();
  });

  it('rejects more than 7 decimal places', () => {
    expect(checkSalaryPrecision('2500.12345678')).toMatch(/7 decimal places/);
  });

  it('rejects negative salaries', () => {
    expect(checkSalaryPrecision('-100')).toBe('Salary must be a positive number');
  });

  it('rejects non-numeric input', () => {
    expect(checkSalaryPrecision('not-a-number')).toBe('Salary must be a positive number');
  });
});

describe('checkDateRange', () => {
  it('is valid when either date is missing', () => {
    expect(checkDateRange(undefined, '2026-01-01')).toBeNull();
    expect(checkDateRange('2026-01-01', undefined)).toBeNull();
  });

  it('accepts an end date after the start date', () => {
    expect(checkDateRange('2026-01-01', '2026-06-01')).toBeNull();
  });

  it('rejects an end date equal to the start date', () => {
    expect(checkDateRange('2026-01-01', '2026-01-01')).toMatch(/after start date/);
  });

  it('rejects an end date before the start date', () => {
    expect(checkDateRange('2026-06-01', '2026-01-01')).toMatch(/after start date/);
  });

  it('rejects unparseable dates', () => {
    expect(checkDateRange('not-a-date', '2026-01-01')).toBe('Enter valid dates');
  });
});

describe('createEmployeeEntrySchema / validateEmployeeEntry', () => {
  it('accepts a fully valid, minimal form', () => {
    expect(validateEmployeeEntry(baseValues())).toEqual({});
  });

  it('requires full name, role, and work email', () => {
    const errors = validateEmployeeEntry(baseValues({ fullName: '', role: '', workEmail: '' }));
    expect(errors.fullName).toBe('Full name is required');
    expect(errors.role).toBe('Role is required');
    expect(errors.workEmail).toBe('Work email is required');
  });

  it('rejects an unsupported currency code', () => {
    const errors = validateEmployeeEntry(baseValues({ currency: 'DOGE' }));
    expect(errors.currency).toMatch(/Currency must be one of/);
  });

  it('accepts a valid wallet address and secret key pair', () => {
    const errors = validateEmployeeEntry(
      baseValues({
        walletAddress: VALID_PUBLIC_KEY,
        secretKey: VALID_SECRET_KEY,
        secretKeyConfirm: VALID_SECRET_KEY,
      })
    );
    expect(errors).toEqual({});
  });

  it('flags a malformed wallet address', () => {
    const errors = validateEmployeeEntry(baseValues({ walletAddress: 'not-a-key' }));
    expect(errors.walletAddress).toBe('Invalid Stellar wallet address format');
  });

  it('flags a malformed secret key', () => {
    const errors = validateEmployeeEntry(baseValues({ secretKey: 'not-a-key' }));
    expect(errors.secretKey).toBe('Invalid Stellar secret key format (must start with S, 56 chars)');
  });

  it('flags a secret key / confirmation mismatch on the confirm field', () => {
    const errors = validateEmployeeEntry(
      baseValues({ secretKey: VALID_SECRET_KEY, secretKeyConfirm: 'S' + 'C'.repeat(55) })
    );
    expect(errors.secretKeyConfirm).toBe('Secret keys do not match');
    expect(errors.secretKey).toBeUndefined();
  });

  it('does not require confirmation when secretKey is blank', () => {
    const errors = validateEmployeeEntry(baseValues({ secretKey: '', secretKeyConfirm: 'anything' }));
    expect(errors.secretKeyConfirm).toBeUndefined();
  });

  it('respects a custom allowed-domains list passed at schema build time', () => {
    const schema = createEmployeeEntrySchema(['company.com']);
    const result = schema.safeParse(baseValues({ workEmail: 'user@gmail.com' }));
    expect(result.success).toBe(false);
  });
});

describe('validateEmployeeEntryField', () => {
  it('returns undefined for a field that currently passes', () => {
    expect(validateEmployeeEntryField('fullName', baseValues())).toBeUndefined();
  });

  it('returns the error message for a field that currently fails', () => {
    expect(validateEmployeeEntryField('fullName', baseValues({ fullName: '' }))).toBe(
      'Full name is required'
    );
  });
});
