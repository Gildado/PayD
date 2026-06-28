import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const MIN_JWT_SECRET_LENGTH = 32;
const disallowedJwtSecretValues = new Set([
  'dev-jwt-secret',
  'dev-jwt-refresh-secret',
  'your_jwt_secret',
  'replace-with-a-long-random-secret',
  'replace-with-a-different-long-random-secret',
]);

const jwtSecretSchema = (name: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z
      .string()
      .min(1, `${name} must be set in the environment`)
      .min(MIN_JWT_SECRET_LENGTH, `${name} must be at least ${MIN_JWT_SECRET_LENGTH} characters long`)
      .refine(
        (value) => !disallowedJwtSecretValues.has(value),
        `${name} must be replaced with a strong random value`
      )
  );

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().default('postgres://localhost:5432/payd_test'),
  DB_POOL_MIN: z.string().default('2'),
  DB_POOL_MAX: z.string().default('20'),
  DB_IDLE_TIMEOUT_MS: z.string().default('30000'),
  DB_CONNECTION_TIMEOUT_MS: z.string().default('5000'),
  DB_STATEMENT_TIMEOUT_MS: z.string().default('30000'),
  DB_QUERY_TIMEOUT_MS: z.string().default('30000'),
  REDIS_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  THROTTLING_TPM: z.string().default('100'),
  THROTTLING_MAX_QUEUE_SIZE: z.string().default('1000'),
  THROTTLING_REFILL_INTERVAL_MS: z.string().default('1000'),
  RATE_LIMIT_AUTH_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_AUTH_MAX: z.string().default('10'),
  RATE_LIMIT_API_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_API_MAX: z.string().default('100'),
  RATE_LIMIT_DATA_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_DATA_MAX: z.string().default('200'),
  JWT_SECRET: jwtSecretSchema('JWT_SECRET'),
  JWT_REFRESH_SECRET: jwtSecretSchema('JWT_REFRESH_SECRET'),
  // Email notification configuration
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid']).default('resend'),
  EMAIL_FROM_ADDRESS: z.string().default('noreply@payd.example.com'),
  EMAIL_FROM_NAME: z.string().default('PayD Payroll System'),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  STELLAR_EXPLORER_URL: z.string().default('https://stellar.expert/explorer/testnet/tx'),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet', 'public']).default('testnet'),
  STELLAR_HORIZON_URL: z.string().optional(),
  STELLAR_MAX_RETRIES: z.string().default('3'),
  STELLAR_RETRY_DELAY_MS: z.string().default('1000'),
  STELLAR_RETRY_DELAY_MAX_MS: z.string().default('10000'),
}).refine((env) => env.JWT_SECRET !== env.JWT_REFRESH_SECRET, {
  message: 'JWT_REFRESH_SECRET must be different from JWT_SECRET',
  path: ['JWT_REFRESH_SECRET'],
});

export const parseEnv = (env: NodeJS.ProcessEnv = process.env) => envSchema.parse(env);

export const config = parseEnv(process.env);

export const getThrottlingConfig = () => ({
  tpm: parseInt(config.THROTTLING_TPM, 10),
  maxQueueSize: parseInt(config.THROTTLING_MAX_QUEUE_SIZE, 10),
  refillIntervalMs: parseInt(config.THROTTLING_REFILL_INTERVAL_MS, 10),
});

export const getRateLimitConfig = () => ({
  auth: {
    windowMs: parseInt(config.RATE_LIMIT_AUTH_WINDOW_MS, 10),
    maxRequests: parseInt(config.RATE_LIMIT_AUTH_MAX, 10),
  },
  api: {
    windowMs: parseInt(config.RATE_LIMIT_API_WINDOW_MS, 10),
    maxRequests: parseInt(config.RATE_LIMIT_API_MAX, 10),
  },
  data: {
    windowMs: parseInt(config.RATE_LIMIT_DATA_WINDOW_MS, 10),
    maxRequests: parseInt(config.RATE_LIMIT_DATA_MAX, 10),
  },
});

export const getPoolConfig = () => ({
  min: parseInt(config.DB_POOL_MIN, 10),
  max: parseInt(config.DB_POOL_MAX, 10),
  idleTimeoutMillis: parseInt(config.DB_IDLE_TIMEOUT_MS, 10),
  connectionTimeoutMillis: parseInt(config.DB_CONNECTION_TIMEOUT_MS, 10),
  statementTimeout: parseInt(config.DB_STATEMENT_TIMEOUT_MS, 10),
  queryTimeout: parseInt(config.DB_QUERY_TIMEOUT_MS, 10),
});
