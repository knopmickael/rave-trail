import { rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
// Apenas saídas geradas. Os caminhos antigos são limpos na transição de arquitetura.
for (const directory of ['frontend/dist/', 'backend/dist/', 'coverage/', 'dist/', 'build/']) {
  await rm(new URL(directory, root), { recursive: true, force: true });
}
console.info('Saídas de build e cobertura removidas.');
