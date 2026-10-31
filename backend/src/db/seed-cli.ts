import { config as loadEnvironment } from 'dotenv';
import { environmentPath } from '../paths.js';
import pg from 'pg';
import { loadConfig } from '../config.js';
import { seedDatabase } from './seed.js';

loadEnvironment({ path: environmentPath });
const pool = new pg.Pool({ connectionString: loadConfig().DATABASE_URL });
try { await seedDatabase(pool); console.info('Catálogo e equipes legadas inicializados.'); }
finally { await pool.end(); }
