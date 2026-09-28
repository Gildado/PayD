import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for Stellar SDK interoperability tests.
 * These tests run against a live standalone Soroban network.
 *
 * Prerequisites:
 *   - Stellar standalone network running at http://localhost:8000/rpc
 *   - WASM artifacts in target/wasm32-unknown-unknown/release/
 *
 * Usage:
 *   npm run test:sdk
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    include: ['src/__tests__/sdk/**/*.test.ts'],
    // SDK tests are excluded from the default test run
    exclude: ['node_modules/**', 'src/**/*.test.tsx', 'src/**/*.unit.test.ts'],
  },
});
