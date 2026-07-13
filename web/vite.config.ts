/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single source of truth: the root package.json version (bumped by commitizen).
// Injected at build time so the app version is never duplicated in source.
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    // docs live at the repo root (../docs); let the dev server read them for the glob
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787', // OIDC login round-trip in dev
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
