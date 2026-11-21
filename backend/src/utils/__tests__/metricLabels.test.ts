import {
  matchedRoutePattern,
  sanitizePathPattern,
  boundedLabelValue,
  bucketedIdLabel,
  buildRequestMetricLabels,
  LABEL_VALUE_MAX_LENGTH,
  ID_LABEL_BUCKETS,
} from '../metricLabels.js';
import type { Request } from 'express';

function reqLike(overrides: Record<string, unknown> = {}): Request {
  return {
    method: 'GET',
    path: '/api/employees/42/payroll',
    baseUrl: '',
    route: undefined,
    ...overrides,
  } as unknown as Request;
}

describe('matchedRoutePattern', () => {
  it('uses the matched Express route pattern, not the concrete URL', () => {
    expect(
      matchedRoutePattern(
        reqLike({
          baseUrl: '/api/employees',
          route: { path: '/:id/payroll' },
          path: '/api/employees/42/payroll',
        })
      )
    ).toBe('/api/employees/:id/payroll');
  });

  it('sanitizes numeric, UUID and opaque identifier segments on unmatched routes', () => {
    expect(matchedRoutePattern(reqLike({ path: '/api/employees/42/payroll' }))).toBe(
      '/api/employees/:id/payroll'
    );
    expect(
      matchedRoutePattern(
        reqLike({ path: '/api/orders/3f2a1b4c-8d9e-4f01-a2b3-1234567890ab' })
      )
    ).toBe('/api/orders/:id');
    expect(matchedRoutePattern(reqLike({ path: '/api/keys/abcdef1234567890XYZ' }))).toBe(
      '/api/keys/:id'
    );
  });

  it('preserves literal segments and parameter placeholders', () => {
    expect(sanitizePathPattern('/api/v1/health/ready')).toBe('/api/v1/health/ready');
    expect(sanitizePathPattern('/api/:organizationId/rewards/:id')).toBe(
      '/api/:organizationId/rewards/:id'
    );
  });

  it('handles RegExp and array route definitions without leaking IDs', () => {
    expect(matchedRoutePattern(reqLike({ baseUrl: '/api/users', route: { path: /^\/\d+$/ } }))).toBe(
      '/api/users/:id'
    );
    expect(
      matchedRoutePattern(reqLike({ baseUrl: '/api/users', route: { path: ['/:id', '/me'] } }))
    ).toBe('/api/users/:id');
  });

  it('caps the pattern length', () => {
    const pattern = matchedRoutePattern(reqLike({ path: `/x/${'a'.repeat(200)}` }));
    expect(pattern.length).toBeLessThanOrEqual(LABEL_VALUE_MAX_LENGTH);
  });
});

describe('bucketedIdLabel / boundedLabelValue', () => {
  it('never emits a raw identifier', () => {
    for (const id of [42, '42', 'org-8811', 'user_abc123', '3f2a1b4c-8d9e-4f01-a2b3-1234567890ab']) {
      const tenant = bucketedIdLabel(id, 'tenant');
      const user = bucketedIdLabel(id, 'user');
      expect(tenant).not.toContain(String(id));
      expect(user).not.toContain(String(id));
      expect(tenant).toMatch(/^tenant_[0-9a-f]{2}$/);
      expect(user).toMatch(/^user_[0-9a-f]{2}$/);
    }
  });

  it('caps cardinality to the configured number of buckets', () => {
    const seen = new Set<string>();
    for (let id = 0; id < 5000; id++) seen.add(bucketedIdLabel(id, 'tenant'));
    expect(seen.size).toBeLessThanOrEqual(ID_LABEL_BUCKETS);
  });

  it('is stable for the same ID and distinct for the two namespaces', () => {
    expect(bucketedIdLabel(42, 'tenant')).toBe(bucketedIdLabel(42, 'tenant'));
    expect(bucketedIdLabel(42, 'tenant')).not.toBe(bucketedIdLabel(42, 'user'));
  });

  it('uses explicit none tokens for missing IDs', () => {
    expect(bucketedIdLabel(undefined, 'tenant')).toBe('tenant_none');
    expect(bucketedIdLabel(null, 'user')).toBe('user_none');
  });

  it('boundedLabelValue truncates long values and keeps them label-safe', () => {
    const value = 'a'.repeat(200);
    const bounded = boundedLabelValue(value, 32);
    expect(bounded).toHaveLength(32);
    expect(bounded).toMatch(/^a+~[0-9a-f]{8}$/);
    expect(boundedLabelValue(undefined)).toBe('none');
  });
});

describe('buildRequestMetricLabels', () => {
  it('builds a complete safe label set for a parameterized request', () => {
    const request = reqLike({
      baseUrl: '/api/employees',
      route: { path: '/:id/payroll' },
      path: '/api/employees/42/payroll',
      tenantId: 42,
      user: { id: 7, organizationId: 42 },
    });
    const labels = buildRequestMetricLabels(request, 200);

    expect(labels).toEqual({
      method: 'GET',
      route: '/api/employees/:id/payroll',
      status_code: '200',
      tenant: bucketedIdLabel(42, 'tenant'),
      user: bucketedIdLabel(7, 'user'),
    });
    expect(labels.route).not.toContain('42');
    expect(labels.route).toBe('/api/employees/:id/payroll');
  });
});
