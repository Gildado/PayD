import {
  DEPENDENCY_CHECK_TIMEOUT_MS,
  criticalDependenciesHealthy,
  toErrorMessage,
  withTimeout,
  type DependencyMap,
  type DependencyStatus,
} from '../healthController.js';

/**
 * Pure unit tests for the typed, bounded health-check primitives. They do not
 * mock modules, so they run under the backend's default ESM Jest config.
 */
const dep = (status: DependencyStatus['status'], critical: boolean): DependencyStatus => ({
  status,
  critical,
});

const deps = (overrides: Partial<DependencyMap> = {}): DependencyMap => ({
  database: dep('healthy', true),
  redis: dep('healthy', true),
  stellarHorizon: dep('healthy', true),
  stellarSoroban: dep('healthy', true),
  elasticsearch: dep('healthy', false),
  email: dep('healthy', false),
  ...overrides,
});

describe('health dependency check primitives', () => {
  it('converts unknown thrown values to safe strings without any', () => {
    expect(toErrorMessage(new Error('db down'))).toBe('db down');
    expect(toErrorMessage('plain string failure')).toBe('plain string failure');
    expect(toErrorMessage({ code: 'ECONNREFUSED' })).toBe('Unknown dependency error');
    expect(toErrorMessage(null)).toBe('Unknown dependency error');
  });

  it('bounds the production dependency timeout to at most two seconds', () => {
    expect(DEPENDENCY_CHECK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEPENDENCY_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });

  it('withTimeout rejects a hanging check instead of waiting forever', async () => {
    const start = Date.now();
    await expect(withTimeout(new Promise(() => {}), 25, 'unit')).rejects.toThrow(
      /unit check timed out after 25ms/
    );
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('withTimeout resolves a fast check with its value', async () => {
    await expect(withTimeout(Promise.resolve(42), 100, 'unit')).resolves.toBe(42);
  });

  it('readiness reflects dependency state: only unhealthy critical deps block it', () => {
    expect(criticalDependenciesHealthy(deps())).toBe(true);
    expect(criticalDependenciesHealthy(deps({ elasticsearch: dep('unhealthy', false) }))).toBe(
      true
    );
    expect(criticalDependenciesHealthy(deps({ redis: dep('not_configured', true) }))).toBe(true);
    expect(criticalDependenciesHealthy(deps({ database: dep('unhealthy', true) }))).toBe(false);
  });
});
