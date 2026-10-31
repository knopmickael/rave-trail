import { config as loadEnvironment } from 'dotenv';
import pg from 'pg';
import { loadConfig } from '../config.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { environmentPath } from '../paths.js';

loadEnvironment({ path: environmentPath });
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
try {
  await migrate(pool);
  await seedDatabase(pool);
  console.info('Migrações aplicadas e catálogo inicializado.');
} finally {
  await pool.end();
}
