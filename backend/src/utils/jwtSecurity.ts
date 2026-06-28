/**
 * JWT Security Startup Validator (#457)
 *
 * Called once at server boot. Validates that JWT secrets meet minimum security
 * requirements. If validation fails the process exits with a non-zero code so
 * that container orchestration systems (Docker, Render, k8s) treat it as a
 * failed deployment rather than a running service with insecure defaults.
 *
 * This is a defence-in-depth layer on top of the Zod schema validation in
 * `config/env.ts`. The Zod schema already rejects weak secrets; this module
 * provides human-readable guidance in the startup logs.
 */

import logger from './logger.js';

const MIN_LENGTH = 32;

const KNOWN_WEAK_VALUES = new Set([
  'dev-jwt-secret',
  'dev-jwt-refresh-secret',
  'your_jwt_secret',
  'replace-with-a-long-random-secret',
  'replace-with-a-different-long-random-secret',
  'secret',
  'changeme',
]);

export interface JwtSecretValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a single JWT secret value.
 */
export function validateJwtSecret(name: string, value: string | undefined): string[] {
  const errors: string[] = [];

  if (!value || value.trim().length === 0) {
    errors.push(`${name} is not set. Set it to a cryptographically random string of at least ${MIN_LENGTH} characters.`);
    return errors;
  }

  if (value.length < MIN_LENGTH) {
    errors.push(`${name} is too short (${value.length} chars). Minimum is ${MIN_LENGTH} characters.`);
  }

  if (KNOWN_WEAK_VALUES.has(value.toLowerCase())) {
    errors.push(`${name} contains a known placeholder value. Generate a strong random secret: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
  }

  return errors;
}

/**
 * Validate that JWT_SECRET and JWT_REFRESH_SECRET are distinct.
 */
export function validateSecretsAreDistinct(jwtSecret: string | undefined, refreshSecret: string | undefined): string[] {
  const errors: string[] = [];
  if (jwtSecret && refreshSecret && jwtSecret === refreshSecret) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values. Using the same secret for both weakens token security.');
  }
  return errors;
}

/**
 * Run all JWT secret checks. Returns a result object instead of throwing so
 * the caller decides whether to exit or only warn (useful in tests).
 */
export function checkJwtSecrets(env: {
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
}): JwtSecretValidationResult {
  const errors: string[] = [
    ...validateJwtSecret('JWT_SECRET', env.JWT_SECRET),
    ...validateJwtSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET),
    ...validateSecretsAreDistinct(env.JWT_SECRET, env.JWT_REFRESH_SECRET),
  ];

  return { valid: errors.length === 0, errors };
}

/**
 * Call at server startup. Logs actionable errors and exits if secrets are
 * insecure. Pass `exitFn` to override `process.exit` in tests.
 */
export function assertJwtSecretsSecure(
  env: { JWT_SECRET?: string; JWT_REFRESH_SECRET?: string },
  exitFn: (code: number) => never = process.exit
): void {
  const result = checkJwtSecrets(env);

  if (!result.valid) {
    logger.error('=== STARTUP ABORTED: Insecure JWT configuration ===');
    result.errors.forEach((msg) => logger.error(`  • ${msg}`));
    logger.error('Fix the above issues in your .env file and restart the server.');
    logger.error('Generate secrets: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    exitFn(1);
  }
}
