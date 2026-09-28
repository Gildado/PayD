import crypto from 'crypto';
import {
  validateJwtSecret,
  validateSecretsAreDistinct,
  checkJwtSecrets,
  assertJwtSecretsSecure,
} from '../../utils/jwtSecurity.js';

const strongSecret = () => crypto.randomBytes(48).toString('hex');

describe('jwtSecurity', () => {
  describe('validateJwtSecret', () => {
    it('returns no errors for a strong secret', () => {
      const errors = validateJwtSecret('JWT_SECRET', strongSecret());
      expect(errors).toHaveLength(0);
    });

    it('reports an error when value is undefined', () => {
      const errors = validateJwtSecret('JWT_SECRET', undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/is not set/);
    });

    it('reports an error when value is an empty string', () => {
      const errors = validateJwtSecret('JWT_SECRET', '');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/is not set/);
    });

    it('reports an error when value is shorter than 32 characters', () => {
      const errors = validateJwtSecret('JWT_SECRET', 'too-short');
      expect(errors.some((e) => e.includes('too short'))).toBe(true);
    });

    it('reports an error for known placeholder "replace-with-a-long-random-secret"', () => {
      const errors = validateJwtSecret('JWT_SECRET', 'replace-with-a-long-random-secret');
      expect(errors.some((e) => e.includes('placeholder'))).toBe(true);
    });

    it('reports an error for known placeholder "dev-jwt-secret"', () => {
      const errors = validateJwtSecret('JWT_SECRET', 'dev-jwt-secret');
      expect(errors.some((e) => e.includes('placeholder'))).toBe(true);
    });

    it('includes the variable name in each error message', () => {
      const errors = validateJwtSecret('JWT_REFRESH_SECRET', undefined);
      expect(errors[0]).toMatch(/JWT_REFRESH_SECRET/);
    });
  });

  describe('validateSecretsAreDistinct', () => {
    it('returns no errors when secrets are different', () => {
      const errors = validateSecretsAreDistinct(strongSecret(), strongSecret());
      expect(errors).toHaveLength(0);
    });

    it('returns an error when both secrets are identical', () => {
      const shared = strongSecret();
      const errors = validateSecretsAreDistinct(shared, shared);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/must be different/);
    });

    it('returns no errors when either value is undefined', () => {
      expect(validateSecretsAreDistinct(undefined, undefined)).toHaveLength(0);
      expect(validateSecretsAreDistinct(strongSecret(), undefined)).toHaveLength(0);
    });
  });

  describe('checkJwtSecrets', () => {
    it('returns valid=true for two strong, distinct secrets', () => {
      const result = checkJwtSecrets({
        JWT_SECRET: strongSecret(),
        JWT_REFRESH_SECRET: strongSecret(),
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid=false when JWT_SECRET is missing', () => {
      const result = checkJwtSecrets({ JWT_REFRESH_SECRET: strongSecret() });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns valid=false when secrets are identical', () => {
      const shared = strongSecret();
      const result = checkJwtSecrets({ JWT_SECRET: shared, JWT_REFRESH_SECRET: shared });
      expect(result.valid).toBe(false);
    });

    it('collects errors for both secrets when both are invalid', () => {
      const result = checkJwtSecrets({
        JWT_SECRET: 'weak',
        JWT_REFRESH_SECRET: 'also-weak',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('assertJwtSecretsSecure', () => {
    it('does not call exitFn when secrets are valid', () => {
      const exitFn = jest.fn() as unknown as (code: number) => never;
      assertJwtSecretsSecure(
        { JWT_SECRET: strongSecret(), JWT_REFRESH_SECRET: strongSecret() },
        exitFn
      );
      expect(exitFn).not.toHaveBeenCalled();
    });

    it('calls exitFn(1) when JWT_SECRET is a placeholder', () => {
      const exitFn = jest.fn() as unknown as (code: number) => never;
      assertJwtSecretsSecure(
        {
          JWT_SECRET: 'replace-with-a-long-random-secret',
          JWT_REFRESH_SECRET: strongSecret(),
        },
        exitFn
      );
      expect(exitFn).toHaveBeenCalledWith(1);
    });

    it('calls exitFn(1) when secrets are missing', () => {
      const exitFn = jest.fn() as unknown as (code: number) => never;
      assertJwtSecretsSecure({}, exitFn);
      expect(exitFn).toHaveBeenCalledWith(1);
    });
  });
});
