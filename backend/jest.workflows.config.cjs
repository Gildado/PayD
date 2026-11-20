const base = require('./jest.config.cjs');

// The application uses NodeNext ESM; Jest 29's in-process mocks use CommonJS.
// Keep this suite independent of the legacy suite's ESM loader requirements.
module.exports = {
  ...base,
  testMatch: ['**/workflows/__tests__/**/*.test.ts'],
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
