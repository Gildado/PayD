import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Plugin to handle missing asset files from @stellar/design-system
const handleMissingAssets = () => ({
  name: 'handle-missing-assets',
  resolveId(id: string) {
    // Handle SCSS/SASS imports
    if (id.endsWith('.scss') || id.endsWith('.sass')) {
      return { id: 'virtual-empty-module', external: false };
    }
    // Handle SVG imports
    if (id.endsWith('.svg')) {
      return { id: 'virtual-svg-module', external: false };
    }
  },
  load(id: string) {
    if (id === 'virtual-empty-module') {
      return '';
    }
    if (id === 'virtual-svg-module') {
      // Return a minimal React component for SVG imports
      return 'export const ReactComponent = () => null;';
    }
  },
});

export default defineConfig({
  plugins: [react(), handleMissingAssets()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false, // Disable CSS processing to avoid ESM issues
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
