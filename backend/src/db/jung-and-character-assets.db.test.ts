import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { abilities } from '@game/content/abilities.js';
import { units } from '@game/content/units.js';
import { encounters } from '@game/content/encounters.js';
import { createBattle, type BattleRecord } from '@game/core/battle.js';
import type { CharacterUnlockData } from '@game/contracts.js';
import { hashSessionToken } from '../auth/crypto.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL deve apontar para um banco exclusivo _test, diferente de DATABASE_URL.');
}
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
const now = Date.now();
const battles = new PostgresBattleRepository(pool, () => 0, () => now);
const definition = (id: string) => units.find((unit) => unit.id === id)!;
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

async function player(completed = 0) {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', {
    tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60_000),
  });
  await game.setTeamSlot(user.id, 0, 'protagonist-main-base');
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1",
    [user.id, JSON.stringify(encounters.slice(0, completed).map((entry) => entry.id))]);
  return user;
}

function mission(data: CharacterUnlockData) {
  const entry = data.characters.find((unit) => unit.id === 'jung-de-grimoria-ii')!;
  if (entry.kind !== 'battle-wins') throw new Error('Esperada missão de vitórias.');
  return entry;
}

async function finish(userId: string, battle: BattleRecord, requestId = randomUUID()) {
  const state = structuredClone(battle.state);
  state.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
  state.teams.player.energy = 100;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [battle.id, JSON.stringify(state)]);
  return battles.submitTurn(userId, battle.id, battle.revision, requestId,
    [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]);
}

async function history(userId: string, enemyId: string, count: number, playerId = 'protagonist-main-base',
  mode = 'quick', status = 'victory') {
  const state = createBattle([definition(playerId)], [definition(enemyId)], Object.values(abilities));
  state.status = status as BattleRecord['state']['status'];
  if (status === 'victory') state.teams.enemy.units[0].hp = 0;
  if (status === 'defeat') state.teams.player.units[0].hp = 0;
  const result = await pool.query<BattleRecord>(`INSERT INTO battles (id, user_id, encounter_id, state, status, mode)
    SELECT gen_random_uuid(), $1, $2, $3::jsonb, $4, $5 FROM generate_series(1, $6)
    RETURNING id, encounter_id AS "encounterId", state, revision`,
    [userId, mode === 'campaign' ? encounters[5].id : null, JSON.stringify(state), status, mode, count]);
  return result.rows;
}

it('coloca Jung II somente no encontro 6 e o disponibiliza no sorteio rápido depois da vitória', async () => {
  const user = await player(5);
  const catalog = await game.getCatalog();
  const original = catalog.units.find((unit) => unit.id === 'rival-a-base')!;
  const second = catalog.units.find((unit) => unit.id === 'jung-de-grimoria-ii')!;
  expect(second.abilityIds).toEqual(definition('jung-de-grimoria-ii').abilityIds);
  expect(second.abilityIds).not.toEqual(original.abilityIds);
  expect(second.characterId).toBe(original.characterId);
  expect(second.maxHp).toBe(original.maxHp);
  expect(second.portrait).toBe('/media/characters/jung-de-grimoria-ii-face.png');
  const map = await battles.getMap(user.id, 'path-1');
  expect(map.encounters[1].enemyUnitIds[0]).toBe('rival-a-base');
  expect(map.encounters[4].enemyUnitIds[0]).toBe('rival-a-base');
  expect(map.encounters[5].enemyUnitIds).toEqual(['jung-de-grimoria-ii', 'rival-b-base']);
  expect((await battles.getQuickBattle(user.id)).opponents.some((unit) => unit.id === second.id)).toBe(false);
  expect(mission(await game.getCharacterUnlocks(user.id)).campaignAvailable).toBe(false);
  const sixth = await battles.startBattle(user.id, encounters[5].id);
  expect(sixth.state.teams.enemy.units.map((unit) => unit.unitId)).toEqual(['jung-de-grimoria-ii', 'rival-b-base']);
  expect(sixth.state.teams.enemy.units[0].portrait).toBe(second.portrait);
  const won = await finish(user.id, sixth);
  expect(won.battle.state.status).toBe('victory');
  expect((await battles.getQuickBattle(user.id)).opponents.find((unit) => unit.id === second.id)?.portrait).toBe(second.portrait);
  expect(mission(await game.getCharacterUnlocks(user.id))).toMatchObject({ campaignAvailable: true, unlocked: false,
    requirements: [expect.objectContaining({ current: 0, target: 25 })] });
  await expect(game.setTeamSlot(user.id, 1, second.id)).rejects.toMatchObject({ statusCode: 403 });
});

it('a 25ª vitória rápida contra Jung II usando Ravi base libera a unidade sem duplicar o progresso', async () => {
  const user = await player(6);
  await history(user.id, 'rival-a-base', 30);
  await history(user.id, 'jung-de-grimoria-ii', 30, 'protagonist-secondary-base');
  await history(user.id, 'jung-de-grimoria-ii', 30, 'protagonist-main-transformed');
  await history(user.id, 'jung-de-grimoria-ii', 30, undefined, 'multiplayer');
  await history(user.id, 'jung-de-grimoria-ii', 1, undefined, 'campaign');
  await history(user.id, 'jung-de-grimoria-ii', 1, undefined, 'quick', 'defeat');
  expect(mission(await game.getCharacterUnlocks(user.id)).requirements[0].current).toBe(0);
  await history(user.id, 'jung-de-grimoria-ii', 24);
  expect(mission(await game.getCharacterUnlocks(user.id))).toMatchObject({ unlocked: false,
    requirements: [expect.objectContaining({ current: 24, target: 25 })] });
  await expect(game.setTeamSlot(user.id, 1, 'jung-de-grimoria-ii')).rejects.toMatchObject({ statusCode: 403 });
  const [last] = await history(user.id, 'jung-de-grimoria-ii', 1, undefined, 'quick', 'active');
  const requestId = randomUUID();
  const response = await finish(user.id, last, requestId);
  expect(response.battle.state.status).toBe('victory');
  expect(mission(await game.getCharacterUnlocks(user.id))).toMatchObject({ unlocked: true,
    requirements: [expect.objectContaining({ current: 25, target: 25 })] });
  const repeated = await battles.submitTurn(user.id, last.id, 0, requestId,
    [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]);
  expect(repeated).toEqual(response);
  await game.setTeamSlot(user.id, 1, 'jung-de-grimoria-ii');
  await seedDatabase(pool);
  const next = await battles.startQuickBattle(user.id);
  expect(next.state.teams.player.units[1]).toMatchObject({ unitId: 'jung-de-grimoria-ii', name: 'Jung de Grimória II',
    hp: 100, portrait: '/media/characters/jung-de-grimoria-ii-face.png', abilityIds: definition('jung-de-grimoria-ii').abilityIds });
});

it('migra a formação antiga e copia as habilidades do Jung original sem alterar equipe ou progresso', async () => {
  const user = await player(5);
  const before = await auth.getProgress(user.id);
  const original = (await game.getCatalog()).units.find((unit) => unit.id === 'rival-a-base');
  await pool.query("UPDATE encounter_enemies SET unit_id = 'rival-a-base' WHERE encounter_id = 'path-1-encounter-6' AND slot_index = 0");
  await pool.query("DELETE FROM unit_abilities WHERE unit_id = 'jung-de-grimoria-ii'");
  await pool.query("DELETE FROM units WHERE id = 'jung-de-grimoria-ii'");
  await pool.query("DELETE FROM schema_migrations WHERE name = '020_jung_de_grimoria_ii.sql'");
  await migrate(pool);
  await seedDatabase(pool);
  await migrate(pool);
  await seedDatabase(pool);
  const catalog = await game.getCatalog();
  expect(catalog.units).toHaveLength(19);
  expect(catalog.units.find((unit) => unit.id === 'rival-a-base')).toEqual(original);
  expect(catalog.units.find((unit) => unit.id === 'jung-de-grimoria-ii')?.abilityIds).toEqual(original?.abilityIds);
  expect((await battles.getMap(user.id, 'path-1')).encounters[5].enemyUnitIds).toEqual(['jung-de-grimoria-ii', 'rival-b-base']);
  expect(await auth.getProgress(user.id)).toEqual(before);
});

it('atualiza imagens de batalhas, transformações e respostas idempotentes preservando todo o combate e suas datas', async () => {
  const user = await player();
  const first = await battles.startBattle(user.id, encounters[0].id);
  first.state.teams.player.units[0].portrait = '/media/characters/protagonist-main-base-face.png';
  first.state.teams.enemy.units[0].portrait = '/media/characters/road-raider-1-base-face.png';
  first.state.pendingTransformation = { actorId: 'player-0', unit: { ...definition('protagonist-main-transformed'),
    portrait: '/media/characters/protagonist-main-transformed-face.png' } };
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [first.id, JSON.stringify(first.state)]);
  const requestId = randomUUID();
  const commands = [{ actorId: 'player-0', abilityId: 'retain-energy' }];
  const response = await battles.submitTurn(user.id, first.id, 0, requestId, commands);
  const progress = await auth.getProgress(user.id);
  const before = (await pool.query('SELECT state, status, revision, log, combo, updated_at, turn_deadline_at, bot_acts_at FROM battles WHERE id = $1', [first.id])).rows[0];
  await pool.query("DELETE FROM schema_migrations WHERE name = '021_character_asset_names.sql'");
  await migrate(pool);
  const after = (await pool.query('SELECT state, status, revision, log, combo, updated_at, turn_deadline_at, bot_acts_at FROM battles WHERE id = $1', [first.id])).rows[0];
  expect(after.state.teams.player.units[0].portrait).toBe('/media/characters/ravi-de-berdal-face.png');
  expect(after.state.teams.enemy.units[0].portrait).toBe('/media/characters/saqueador-da-estrada-i-face.png');
  expect(after.state.pendingTransformation.unit.portrait).toBe('/media/characters/ravi-berserk-face.png');
  function withoutArtwork(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(withoutArtwork);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .filter(([key]) => key !== 'portrait' && key !== 'illustration').map(([key, entry]) => [key, withoutArtwork(entry)]));
    return value;
  }
  expect(withoutArtwork(after)).toEqual(withoutArtwork(before));
  const replay = await battles.submitTurn(user.id, first.id, 0, requestId, commands);
  expect(replay.battle.state.teams.player.units[0].portrait).toBe('/media/characters/ravi-de-berdal-face.png');
  expect(replay.battle.state.pendingTransformation?.unit.portrait).toBe('/media/characters/ravi-berserk-face.png');
  expect(withoutArtwork(replay)).toEqual(withoutArtwork(response));
  expect(await auth.getProgress(user.id)).toEqual(progress);
  await migrate(pool);
  const unchanged = (await pool.query('SELECT state, status, revision, log, combo, updated_at, turn_deadline_at, bot_acts_at FROM battles WHERE id = $1', [first.id])).rows[0];
  expect(unchanged).toEqual(after);
});
