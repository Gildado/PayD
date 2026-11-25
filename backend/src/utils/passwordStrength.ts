/**
 * Password strength validation for organization account creation.
 *
 * Complexity requirements:
 *  - Minimum 12 characters
 *  - At least one uppercase letter (A-Z)
 *  - At least one lowercase letter (a-z)
 *  - At least one digit (0-9)
 *  - At least one special character from the allowed set
 *  - Must not contain the user's email prefix (username harvesting resistance)
 *  - (Optional) Must not appear in known breach databases (if breach checking enabled)
 */

import { BreachedPasswordChecker, BreachCheckConfig } from './breachedPasswordChecker.js';

export interface PasswordValidationResult {
  /** Whether the password satisfies all complexity requirements. */
  valid: boolean;
  /** Human-readable list of requirement violations; empty when `valid` is `true`. */
  errors: string[];
  /** Strength score in the range 0–4 (0 = very weak, 4 = very strong). */
  score: number;
  /** Whether the password appears in known breach databases (optional, if breach checking enabled). */
  breached?: boolean;
}

let breachChecker: BreachedPasswordChecker | null = null;

/**
 * Configure the breach password checker.
 * Call this during application startup if breach checking is enabled.
 */
export function configureBreachChecker(config: BreachCheckConfig): void {
  breachChecker = new BreachedPasswordChecker(config);
}

/**
 * Inject a custom breach checker (useful for testing).
 */
export function injectBreachChecker(checker: BreachedPasswordChecker): void {
  breachChecker = checker;
}

const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;\':",.<>?/`~\\';
const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/`~\\]/;

/**
 * Validate password complexity for a new organization admin account.
 * Optionally checks against known breach databases if breach checking is enabled.
 *
 * @param password  - The raw password to validate.
 * @param email     - Optional email; prevents trivially email-derived passwords.
 * @returns         PasswordValidationResult with errors, breach status, and numeric score.
 */
export async function validatePasswordStrength(
  password: string,
  email?: string
): Promise<PasswordValidationResult> {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required.'], score: 0 };
  }

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long.');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A–Z).');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a–z).');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one digit (0–9).');
  }

  if (!SPECIAL_CHARS_REGEX.test(password)) {
    errors.push(
      `Password must contain at least one special character (${SPECIAL_CHARS}).`
    );
  }

  if (email) {
    const emailPrefix = email.split('@')[0].toLowerCase();
    if (emailPrefix.length >= 4 && password.toLowerCase().includes(emailPrefix)) {
      errors.push('Password must not contain your email address.');
    }
  }

  // Score: one point per satisfied requirement (max 4 bonus points)
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) score++;
  if (SPECIAL_CHARS_REGEX.test(password)) score++;

  const result: PasswordValidationResult = {
    valid: errors.length === 0,
    errors,
    score: Math.min(score, 4) as 0 | 1 | 2 | 3 | 4,
  };

  // Check breach database if enabled and password passes basic complexity
  if (breachChecker && result.valid) {
    try {
      result.breached = await breachChecker.isBreached(password);
      if (result.breached) {
        result.valid = false;
        result.errors.push('This password has appeared in known data breaches. Please choose a different password.');
      }
    } catch (err) {
      console.warn('[password-strength] Breach check failed:', err instanceof Error ? err.message : err);
      // Non-fatal: continue with other validations
    }
  }

  return result;

/**
 * Returns a human-readable label for a numeric password strength score.
 *
 * @param score - Numeric score in the range 0–4 (as returned by {@link validatePasswordStrength})
 * @returns A label such as `'Very Weak'`, `'Weak'`, `'Fair'`, `'Strong'`, or `'Very Strong'`.
 *          Returns `'Unknown'` for out-of-range values.
 */
export function scoreLabel(score: number): string {
  return ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][score] ?? 'Unknown';
}
