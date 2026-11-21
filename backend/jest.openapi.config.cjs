const base = require('./jest.config.cjs');

// The Express app (and therefore supertest route conformance) uses
// `import.meta`, so these suites run under Node's ESM VM loader. Only
// `*.openapi.test.ts` files are matched; no database or server is started.
module.exports = {
  ...base,
  testMatch: ['**/__tests__/**/*.openapi.test.ts'],
};
