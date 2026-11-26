import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { migrationDirectory } from '../paths.js';

export async function migrate(pool: Pool, directory = migrationDirectory): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(72583619)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (applied.rowCount) continue;
      if (/^\d+_zz_cms_/.test(file)) {
        // On a new installation the normal startup seed has not run yet. CMS SQL
        // may reference baseline abilities/units, so prepare that baseline first.
        const bootstrap = await client.query(`SELECT NOT EXISTS (SELECT 1 FROM units WHERE id='protagonist-main-base')
          AND NOT EXISTS (SELECT 1 FROM cms_content_overrides WHERE entity='characters') AS needed`);
        if (bootstrap.rows[0].needed) {
          const { seedCatalog } = await import('./seed.js');
          await seedCatalog(client);
        }
      }
      await client.query(await readFile(new URL(file, directory), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
