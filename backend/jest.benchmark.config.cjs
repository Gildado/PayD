const base = require('./jest.config.cjs');

// Dedicated config for the nightly fixture-based benchmark. Like the unit
// config it runs CommonJS-compatible suites without the ESM VM loader; it only
// matches `*.benchmark.test.ts` files so the benchmark never runs in the
// regular unit/test suites.
module.exports = {
  ...base,
  testMatch: ['**/__tests__/**/*.benchmark.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: { module: 'CommonJS', moduleResolution: 'Node', isolatedModules: true },
        diagnostics: false,
      },
    ],
  },
};
