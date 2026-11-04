import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createInitialProgress } from '@game/contracts.js';
import { hashSessionToken } from '../auth/crypto.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { migrate } from './migrations.js';
import { resetPlayerProgress } from './reset-progress.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL deve apontar para um banco exclusivo cujo nome termine em _test, diferente de DATABASE_URL.');
}
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const session = () => ({ tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60000) });

beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

it('zera somente o progresso, a equipe e as batalhas da conta informada', async () => {
  const target = await auth.register('KNOPMICKAEL@example.com'.toLowerCase(), 'hash', session());
  const other = await auth.register('outra@example.com', 'hash', session());
  await pool.query(`UPDATE player_progress SET data = $2::jsonb WHERE user_id = $1`, [target.id, JSON.stringify({
    schemaVersion: 1, audioEnabled: false, completedEncounters: ['path-1-encounter-1'],
    unlockedUnitIds: ['protagonist-main-base', 'road-raider-1-base'], availablePathIds: ['path-1', 'path-2'],
    missionProgressResets: { 'road-raider-1-base': new Date().toISOString() },
  })]);
  await pool.query("UPDATE player_team_slots SET unit_id = 'road-raider-1-base' WHERE user_id = $1 AND slot_index = 0", [target.id]);
  await pool.query(`INSERT INTO battles (id, user_id, encounter_id, state, status, mode)
    VALUES (gen_random_uuid(), $1, NULL, '{}'::jsonb, 'victory', 'quick')`, [target.id]);
  const otherBefore = await auth.getProgress(other.id);

  const result = await resetPlayerProgress(pool, '  KNOPMICKAEL@example.com  ');

  expect(result).toMatchObject({ userId: target.id, email: 'knopmickael@example.com', battlesDeleted: 1 });
  expect(await auth.getProgress(target.id)).toEqual(createInitialProgress());
  expect((await pool.query('SELECT count(*)::int AS count FROM battles WHERE user_id = $1', [target.id])).rows[0].count).toBe(0);
  expect(await auth.getProgress(other.id)).toEqual(otherBefore);
});

it('recusa uma conta inexistente sem alterar dados', async () => {
  const user = await auth.register('existente@example.com', 'hash', session());
  const before = await auth.getProgress(user.id);
  await expect(resetPlayerProgress(pool, 'inexistente@example.com')).rejects.toThrow('Conta não encontrada');
  expect(await auth.getProgress(user.id)).toEqual(before);
});
