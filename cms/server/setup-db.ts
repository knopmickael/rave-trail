import { createPool } from './config.js';
import { migrate } from '../../backend/src/db/migrations.js';

const pool = createPool();
try { await migrate(pool); console.info('Migrações aplicadas. Banco pronto para o CMS; seed não executado.'); }
finally { await pool.end(); }
