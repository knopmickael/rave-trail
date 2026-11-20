import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { STARTER_UNIT_IDS } from '@game/content/units.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { compactCompletedBattles } from './battle-compaction.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo de testes obrigatório.');
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
const battles = new PostgresBattleRepository(pool);
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

it('compacta encerradas sem perder missões, datas ou isolamento; preserva ativas e é idempotente', async () => {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) });
  for (const [slot, id] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, id);
  const battle = await battles.startQuickBattle(user.id);
  battle.state.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
  await pool.query('UPDATE battles SET state=$2 WHERE id=$1', [battle.id, JSON.stringify(battle.state)]);
  await battles.submitTurn(user.id, battle.id, 0, randomUUID(), [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]);
  const before = await game.getCharacterUnlocks(user.id);
  const date = (await pool.query('SELECT updated_at FROM battles WHERE id=$1', [battle.id])).rows[0].updated_at;
  const active = await battles.startQuickBattle(user.id);
  expect(await compactCompletedBattles(pool, new Date(Date.now() + 1000))).toBe(1);
  const saved = (await pool.query('SELECT state,log,combo,summary,updated_at FROM battles WHERE id=$1', [battle.id])).rows[0];
  expect(saved.state).toBeNull(); expect(saved.log).toEqual([]); expect(saved.combo).toBeNull();
  expect(saved.summary.playerUnitIds).toEqual([...STARTER_UNIT_IDS]);
  expect(saved.updated_at).toEqual(date);
  expect((await pool.query('SELECT * FROM battle_commands WHERE battle_id=$1', [battle.id])).rows).toEqual([]);
  expect(await game.getCharacterUnlocks(user.id)).toEqual(before);
  expect((await battles.getBattle(user.id, battle.id)).state.status).toBe('victory');
  expect((await battles.getBattle(user.id, active.id)).state.status).toBe('active');
  expect(await compactCompletedBattles(pool, new Date(Date.now() + 1000))).toBe(0);
});

it('não declara exatos os contadores de batalha ativa anterior à migração', async () => {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) });
  for (const [slot, id] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, id);
  const battle = await battles.startQuickBattle(user.id);
  battle.state.turn = 21; battle.state.teams.player.turns = 11; battle.state.teams.enemy.turns = 10;
  await pool.query('UPDATE battles SET state=$2,round_count=NULL,executed_turns=NULL WHERE id=$1', [battle.id, JSON.stringify(battle.state)]);
  await battles.submitTurn(user.id, battle.id, 0, randomUUID(), []);
  await battles.abandonBattle(user.id, battle.id);
  await compactCompletedBattles(pool, new Date(Date.now() + 1000));
  const data = (await pool.query('SELECT summary FROM battles WHERE id=$1', [battle.id])).rows[0].summary;
  expect(data.countersExact).toBe(false);
  expect(data.totalTurns).toBeGreaterThanOrEqual(21);
});
