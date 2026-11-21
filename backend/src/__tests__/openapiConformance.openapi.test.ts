import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { z } from 'zod';
import app from '../app.js';
import { swaggerSpec } from '../config/swaggerConfig.js';

/**
 * Response-conformance gates for the 20 highest-traffic API routes.
 *
 * Every case performs a real supertest request against the Express app (no
 * server is started) and validates the JSON body with a Zod schema. Requests
 * that require authentication are intentionally left unauthenticated so the
 * documented 401 error envelope is exercised instead of a database-backed
 * success path. This keeps the suite deterministic and infra-free.
 */

const livenessSchema = z.object({
  status: z.literal('alive'),
  timestamp: z.string().datetime(),
  uptime: z.number().nonnegative(),
  inFlightRequests: z.number().int().nonnegative(),
});

const discoverySchema = z.object({
  name: z.string(),
  currentVersion: z.string(),
  supportedVersions: z.array(z.string()),
  endpoints: z.object({
    v1: z.string(),
    health: z.string(),
    openapi: z.string(),
  }),
});

const openApiSpecSchema = z.object({
  openapi: z.string().startsWith('3.'),
  info: z.object({ title: z.string(), version: z.string() }),
  paths: z.record(z.string(), z.unknown()),
});

const unauthorizedSchema = z.object({
  code: z.literal('UNAUTHORIZED'),
  message: z.string().min(1),
  details: z.array(z.unknown()),
});

const problemSchema = (status: 400 | 404, code: 'VALIDATION_ERROR' | 'NOT_FOUND') =>
  z.object({
    type: z.string().startsWith('urn:payd:error:'),
    title: z.string(),
    status: z.literal(status),
    detail: z.string(),
    instance: z.string().optional(),
    code: z.literal(code),
    message: z.string(),
    details: z.array(z.unknown()),
    errors: z.array(z.unknown()).optional(),
    requestId: z.string().optional(),
  });

const circuitBreakersSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      name: z.string(),
      state: z.string(),
      failureCount: z.number().int().nonnegative(),
      successCount: z.number().int().nonnegative(),
      lastFailureAt: z.string().nullable(),
      openedAt: z.string().nullable(),
      updatedAt: z.string(),
    })
  ),
});

const contractListSchema = z.object({
  contracts: z.array(z.unknown()),
  timestamp: z.string(),
  count: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

const throttlingStatusSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      tpm: z.number(),
      currentTokens: z.number(),
      maxTokens: z.number(),
      queueSize: z.number(),
      maxQueueSize: z.number(),
      processedCount: z.number(),
      rejectedCount: z.number(),
      isProcessing: z.boolean(),
    })
    .passthrough(),
});

const missingParameterSchema = z.object({ error: z.string().min(1) });

type HttpMethod = 'get' | 'post';

interface ConformanceCase {
  name: string;
  method: HttpMethod;
  path: string;
  status: number;
  schema: z.ZodTypeAny;
}

const validationProblem = problemSchema(400, 'VALIDATION_ERROR');
const notFoundProblem = problemSchema(404, 'NOT_FOUND');

const cases: ConformanceCase[] = [
  {
    name: 'stellar.toml discovery returns a documented problem response',
    method: 'get',
    path: '/.well-known/stellar.toml',
    status: 404,
    schema: notFoundProblem,
  },
  {
    name: 'API discovery returns its documented envelope',
    method: 'get',
    path: '/api',
    status: 200,
    schema: discoverySchema,
  },
  {
    name: 'liveness probe returns its documented envelope',
    method: 'get',
    path: '/healthz',
    status: 200,
    schema: livenessSchema,
  },
  {
    name: 'OpenAPI spec (v1 alias) returns its documented envelope',
    method: 'get',
    path: '/api/openapi.json',
    status: 200,
    schema: openApiSpecSchema,
  },
  {
    name: 'OpenAPI spec returns its documented envelope',
    method: 'get',
    path: '/api/v1/openapi.json',
    status: 200,
    schema: openApiSpecSchema,
  },
  {
    name: 'registration validation errors use the problem schema',
    method: 'post',
    path: '/api/v1/auth/register',
    status: 400,
    schema: validationProblem,
  },
  {
    name: 'login validation errors use the problem schema',
    method: 'post',
    path: '/api/v1/auth/login',
    status: 400,
    schema: validationProblem,
  },
  {
    name: 'admin audit requires authentication',
    method: 'get',
    path: '/api/v1/admin-audit',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'payroll analytics requires authentication',
    method: 'get',
    path: '/api/v1/analytics/payroll',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'asset issuance requires authentication',
    method: 'post',
    path: '/api/assets/issue',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'circuit-breaker listing returns its documented envelope',
    method: 'get',
    path: '/api/v1/circuit-breakers',
    status: 200,
    schema: circuitBreakersSchema,
  },
  {
    name: 'contract listing returns its documented envelope',
    method: 'get',
    path: '/api/contracts',
    status: 200,
    schema: contractListSchema,
  },
  {
    name: 'v1 contract listing requires authentication',
    method: 'get',
    path: '/api/v1/contracts',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'organization profile requires authentication',
    method: 'get',
    path: '/api/v1/organizations/me',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'stellar throttling status returns its documented envelope',
    method: 'get',
    path: '/api/stellar-throttling/status',
    status: 200,
    schema: throttlingStatusSchema,
  },
  {
    name: 'rate-limit status rejects a missing identifier',
    method: 'get',
    path: '/api/v1/rate-limit/status',
    status: 400,
    schema: missingParameterSchema,
  },
  {
    name: 'v1 employee listing requires authentication',
    method: 'get',
    path: '/api/v1/employees',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'employee listing requires authentication',
    method: 'get',
    path: '/api/employees',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'notification history requires authentication',
    method: 'get',
    path: '/api/v1/notifications/history',
    status: 401,
    schema: unauthorizedSchema,
  },
  {
    name: 'payment pathfinding requires authentication',
    method: 'post',
    path: '/api/v1/payments/pathfind',
    status: 401,
    schema: unauthorizedSchema,
  },
];

describe('OpenAPI response conformance (top 20 routes)', () => {
  it.each(cases)('validates $name', async ({ method, path, status, schema }) => {
    // Documentation conformance: the exercised operation must be in the spec.
    expect(swaggerSpec.paths?.[path]?.[method]).toBeDefined();

    // Bound every request so a slow dependency can never stall CI.
    const response = await (request(app) as any)[method](path).timeout({ response: 5_000 });

    expect(response.status).toBe(status);
    const parsed = schema.safeParse(response.body);
    if (!parsed.success) {
      throw new Error(`${method.toUpperCase()} ${path} response did not match schema: ${JSON.stringify(parsed.error.issues)}`);
    }
    expect(parsed.success).toBe(true);
  });
});
