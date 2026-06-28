/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      nodePolyfills({
        include: ['buffer'],
        globals: {
          Buffer: true,
        },
      }),
      wasm(),
    ],
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            stellar: ['@stellar/stellar-sdk'],
            ui: ['lucide-react', 'framer-motion'],
            vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
            analytics: ['@sentry/react'],
            charts: ['recharts'],
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['@stellar/stellar-xdr-json'],
    },
    define: {
      global: 'window',
    },
    envPrefix: 'PUBLIC_',
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/friendbot': {
          target: 'http://localhost:8000/friendbot',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  };
});
