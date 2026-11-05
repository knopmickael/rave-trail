import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  entryPoints: ['backend/src/index.ts', 'backend/src/db/migrate.ts'],
  outdir: 'backend/dist',
  outbase: 'backend/src',
  bundle: true,
  packages: 'external',
  alias: { '@game': fileURLToPath(new URL('../shared/src', import.meta.url)) },
  platform: 'node',
  target: 'node22',
  format: 'esm',
  tsconfig: 'backend/tsconfig.json',
  sourcemap: true,
  sourcesContent: false,
  logLevel: 'info',
});
