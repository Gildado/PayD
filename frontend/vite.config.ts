/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

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
      VitePWA({
        // We call registerSW ourselves from main.tsx.
        injectRegister: false,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        manifest: {
          name: 'PayD — Stellar Payroll',
          short_name: 'PayD',
          description:
            'Payroll and payment history for Stellar-based teams, with offline access to recent transactions.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#080b10',
          theme_color: '#080b10',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icons/maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Precache the built app shell: HTML, JS, CSS, and fonts so the
          // app loads offline after the first visit.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            // Transaction/audit history data — stale-while-revalidate so
            // cached data renders instantly while a background refresh
            // keeps it current when online.
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith('/api/v1/audit'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'transaction-history-audit-api',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && url.pathname.startsWith('/api/events/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'transaction-history-events-api',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Google Fonts: stylesheet + font files
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          // Keep overall precache + runtime cache usage well under the
          // 50MB budget: bound file size, entry counts, and ages above.
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          // Enable SW in `vite dev` so offline behavior can be tested locally.
          enabled: true,
          type: 'module',
        },
      }),
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
    envPrefix: ['VITE_', 'PUBLIC_'],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
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
