import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  // Ambos ficam no mesmo nivel (backend/dist/) porque paths.ts resolve
  // migrations/, .env e frontend/dist relativos ao arquivo compilado.
  entryPoints: { index: 'backend/src/index.ts', migrate: 'backend/src/db/migrate.ts' },
  outdir: 'backend/dist',
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
