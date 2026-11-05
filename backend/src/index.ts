import { config as loadEnvironment } from 'dotenv';
import pg from 'pg';
import { registerFrontend } from './frontend.js';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { PostgresAuthRepository } from './db/auth-repository.js';
import { PostgresGameRepository } from './db/game-repository.js';
import { PostgresBattleRepository } from './db/battle-repository.js';
import { environmentPath, frontendDistPath } from './paths.js';

loadEnvironment({ path: environmentPath });
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 5000 });
pool.on('error', (error) => console.error('Falha em conexão ociosa do PostgreSQL:', error.message));
await pool.query('SELECT 1');
const battleRepository = new PostgresBattleRepository(pool);
const app = await createApp({
  repository: new PostgresAuthRepository(pool),
  gameRepository: new PostgresGameRepository(pool),
  battleRepository,
  origin: config.APP_ORIGIN,
  production: config.NODE_ENV === 'production',
  logger: true,
  checkDatabase: async () => { await pool.query('SELECT 1'); },
});

if (config.NODE_ENV === 'production') {
  await registerFrontend(app, frontendDistPath);
}

let advancingTurns: Promise<void> | null = null;
const turnTimer = setInterval(() => {
  if (advancingTurns) return;
  advancingTurns = battleRepository.processDueBattles().catch((error) => app.log.error({ err: error }, 'Falha ao atualizar prazos de batalha'))
    .finally(() => { advancingTurns = null; });
}, 1000);
turnTimer.unref();
app.addHook('onClose', async () => { clearInterval(turnTimer); await advancingTurns; await pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
await app.listen({ host: config.HOST, port: config.PORT });
