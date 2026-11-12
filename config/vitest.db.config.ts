import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  resolve: { alias: { '@game': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
  test: {
    include: ['backend/src/**/*.db.test.ts', 'cms/server/**/*.db.test.ts'],
    environment: 'node',
    fileParallelism: false,
  },
});
