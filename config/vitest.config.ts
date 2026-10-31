import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  resolve: { alias: { '@game': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
  plugins: [react()],
  test: {
    include: ['backend/src/**/*.test.ts', 'frontend/src/**/*.test.tsx', 'tools/**/*.test.ts'],
    exclude: ['backend/src/**/*.db.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
