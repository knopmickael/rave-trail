// Baseline fixtures intentionally exclude versioned CMS authoring. Repository
// behavior tests assert the shared catalog; authoring replay is tested separately
// by cms/server/migrations.db.test.ts and new-abilities.db.test.ts (the full chain).
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { afterAll } from 'vitest';
import { migrationDirectory } from '../paths.js';
import { migrate as migrateDatabase } from './migrations.js';

let baseline: Promise<URL> | undefined;
async function baselineDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'rave-baseline-migrations-'));
  const destination = pathToFileURL(directory + '/');
  for (const name of await readdir(migrationDirectory)) {
    if (name.endsWith('.sql') && !/^\d+_zz_cms_/.test(name)) await copyFile(new URL(name, migrationDirectory), new URL(name, destination));
  }
  return destination;
}
afterAll(async () => { if (baseline) await rm(await baseline, { recursive: true, force: true }); });

export async function migrate(pool: Pool, directory?: URL) {
  if (!directory) baseline ??= baselineDirectory();
  await migrateDatabase(pool, directory ?? await baseline!);
}
