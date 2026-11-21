const base = require('./jest.config.cjs');

// Unit suites that must run without the ESM loader (`--experimental-vm-modules`).
// Files named `*.unit.test.ts` use CommonJS-compatible Jest globals and only
// exercise pure helpers, mocked collaborators, or the static migration linter.
module.exports = {
  ...base,
  testMatch: ['**/__tests__/**/*.unit.test.ts'],
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
