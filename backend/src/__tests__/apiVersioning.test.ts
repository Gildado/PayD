/**
 * API Versioning Integration Tests
 *
 * Verifies that:
 *  - All canonical endpoints live under /api/v1/
 *  - Version headers are present on every response
 *  - Legacy /api/ routes return deprecation headers
 *  - Non-API routes (health, stellar.toml) are header-neutral
 *  - The /api discovery endpoint returns correct metadata
 */

import request from 'supertest';
import app from '../app.js';

// ---------------------------------------------------------------------------
// Version header helpers
// ---------------------------------------------------------------------------

function expectVersionHeaders(headers: Record<string, string>) {
  expect(headers['x-api-version']).toBeDefined();
  expect(headers['x-api-current-version']).toBe('v1');
  expect(headers['x-api-supported-versions']).toContain('v1');
}

function expectDeprecationHeaders(headers: Record<string, string>) {
  expect(headers['deprecation']).toBe('true');
  expect(headers['sunset']).toBe('Sat, 01 Jan 2027 00:00:00 GMT');
  expect(headers['x-api-deprecation-message']).toMatch(/\/api\/v1\//);
  expect(headers['link']).toMatch(/rel="successor-version"/);
}

function expectNoDeprecationHeaders(headers: Record<string, string>) {
  expect(headers['deprecation']).toBeUndefined();
  expect(headers['sunset']).toBeUndefined();
}

// ---------------------------------------------------------------------------
// /api discovery endpoint
// ---------------------------------------------------------------------------

describe('GET /api — discovery endpoint', () => {
  it('returns API metadata with current version and supported versions', async () => {
    const res = await request(app).get('/api');

    expect(res.status).toBe(200);
    expect(res.body.currentVersion).toBe('v1');
    expect(res.body.supportedVersions).toContain('v1');
    expect(res.body.endpoints.v1).toBe('/api/v1');
    expect(res.body.endpoints.health).toBe('/api/v1/health');
    expect(res.body.endpoints.openapi).toBe('/api/v1/openapi.json');
  });
});

// ---------------------------------------------------------------------------
// Version headers — present on every response
// ---------------------------------------------------------------------------

describe('Version headers', () => {
  it('are present on /api/v1/ requests', async () => {
    const res = await request(app).get('/api/v1/rate-limit/tiers');
    expectVersionHeaders(res.headers);
  });

  it('are present on legacy /api/ requests', async () => {
    const res = await request(app).get('/api/employees');
    expectVersionHeaders(res.headers);
  });

  it('are present on the health endpoint', async () => {
    const res = await request(app).get('/health');
    expectVersionHeaders(res.headers);
  });
});

// ---------------------------------------------------------------------------
// /api/v1/ — no deprecation headers
// ---------------------------------------------------------------------------

describe('Versioned routes (/api/v1/)', () => {
  const v1Paths = [
    '/api/v1/employees',
    '/api/v1/payments',
    '/api/v1/assets',
    '/api/v1/search',
    '/api/v1/payroll',
    '/api/v1/webhooks',
    '/api/v1/notifications',
    '/api/v1/rates',
    '/api/v1/stellar-throttling',
    '/api/v1/contracts',
    '/api/v1/auth',
    '/api/v1/bulk-payments',
    '/api/v1/exports',
    '/api/v1/freeze',
    '/api/v1/taxes',
    '/api/v1/balance',
    '/api/v1/trustline',
    '/api/v1/multisig',
    '/api/v1/fees',
    '/api/v1/claims',
    '/api/v1/path-payments',
    '/api/v1/audit',
    '/api/v1/tenant-configs',
    '/api/v1/health',
    '/api/v1/openapi.json',
  ];

  it.each(v1Paths)('%s does not return deprecation headers', async (path) => {
    const res = await request(app).get(path);
    // Any status is fine — we only care about headers, not auth
    expectVersionHeaders(res.headers);
    expectNoDeprecationHeaders(res.headers);
  });
});

// ---------------------------------------------------------------------------
// Legacy /api/ paths — deprecation headers expected
// ---------------------------------------------------------------------------

describe('Legacy routes (/api/ without version)', () => {
  const legacyPaths = [
    '/api/employees',
    '/api/payroll',
    '/api/assets',
    '/api/payments',
    '/api/search',
    '/api/stellar-throttling',
  ];

  it.each(legacyPaths)('%s returns deprecation headers', async (path) => {
    const res = await request(app).get(path);
    expectVersionHeaders(res.headers);
    expectDeprecationHeaders(res.headers);
  });

  it('successor-version Link header points to the /api/v1 equivalent', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.headers['link']).toContain('/api/v1/employees');
  });
});

// ---------------------------------------------------------------------------
// Non-API paths — no deprecation headers
// ---------------------------------------------------------------------------

describe('Non-API paths', () => {
  it('/health has version headers but no deprecation headers', async () => {
    const res = await request(app).get('/health');
    expectVersionHeaders(res.headers);
    expectNoDeprecationHeaders(res.headers);
  });
});
