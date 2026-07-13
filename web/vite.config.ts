/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
