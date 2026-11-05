import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashSessionToken } from '../auth/crypto.js';
import { abilities } from '@game/content/abilities.js';
import { STARTER_UNIT_IDS, units } from '@game/content/units.js';
import { createBattle, type BattleRecord } from '@game/core/battle.js';
import type { CharacterUnlockData } from '@game/contracts.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { encounters } from '@game/content/encounters.js';
import { characterUnlockProgress, type BattleVictory } from '@game/core/unlocks.js';
import { KALIS_UNIT_ID, RIDAN_UNIT_ID } from '@game/content/unlocks.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL deve apontar para um banco exclusivo cujo nome termine em _test, diferente de DATABASE_URL.');
}
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
const battles = new PostgresBattleRepository(pool);
const session = () => ({ tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60000) });
const definition = (id: string) => units.find((unit) => unit.id === id)!;
const entry = (data: CharacterUnlockData, id: string) => data.characters.find((unit) => unit.id === id)!;
const current = (data: CharacterUnlockData, id: string, index = 0) => {
  const unit = entry(data, id);
  if (unit.kind !== 'battle-wins') throw new Error('Esperada meta de combate.');
  return unit.requirements[index].current;
};

beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

async function player(completed = 4) {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', session());
  await game.setTeamSlot(user.id, 0, STARTER_UNIT_IDS[0]);
  await complete(user.id, completed);
  return user;
}

async function complete(userId: string, count: number) {
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1",
    [userId, JSON.stringify(encounters.slice(0, count).map((entry) => entry.id))]);
}

// Histórico confiável de testes: modos, equipes e resultados nunca são fornecidos pelo cliente HTTP.
async function history(userId: string, enemyIds: string[], count: number, playerIds: string[] = [STARTER_UNIT_IDS[0]],
  mode: 'quick' | 'multiplayer' | 'campaign' = 'quick', status: 'victory' | 'defeat' | 'active' = 'victory') {
  const state = createBattle(playerIds.map(definition), enemyIds.map(definition), Object.values(abilities));
  state.status = status;
  if (status === 'victory') state.teams.enemy.units.forEach((unit) => { unit.hp = 0; });
  if (status === 'defeat') state.teams.player.units.forEach((unit) => { unit.hp = 0; });
  const encounterId = mode === 'campaign' ? 'path-1-encounter-1' : null;
  const inserted = await pool.query<BattleRecord>(`INSERT INTO battles (id, user_id, encounter_id, state, status, mode)
    SELECT gen_random_uuid(), $1, $2, $3::jsonb, $4, $5 FROM generate_series(1, $6)
    RETURNING id, encounter_id AS "encounterId", state, revision`, [userId, encounterId, JSON.stringify(state), status, mode, count]);
  return inserted.rows;
}

async function finish(userId: string, battle: BattleRecord, requestId = randomUUID()) {
  const snapshot = JSON.parse(JSON.stringify(battle.state)) as BattleRecord['state'];
  snapshot.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
  snapshot.teams.player.energy = 100;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [battle.id, JSON.stringify(snapshot)]);
  return battles.submitTurn(userId, battle.id, 0, requestId, [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]);
}

it('a quinta vitória rápida libera os saqueadores na mesma transação e o reenvio não duplica progresso', async () => {
  const user = await player();
  const raiders = ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'];
  await pool.query(`UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', '["path-1-encounter-1"]') WHERE user_id = $1`, [user.id]);
  await history(user.id, raiders, 4);
  expect(current(await game.getCharacterUnlocks(user.id), raiders[0], 1)).toBe(4);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).not.toContain(raiders[0]);
  const quick = await new PostgresBattleRepository(pool, (maximum) => maximum - 1).startQuickBattle(user.id);
  const requestId = randomUUID();
  const result = await finish(user.id, quick, requestId);
  expect(result.battle.state.status).toBe('victory');
  expect(result.events.some((event) => /desbloque|liberad/i.test(event.message))).toBe(false);
  const data = await game.getCharacterUnlocks(user.id);
  for (const id of raiders) {
    expect(entry(data, id).unlocked).toBe(true);
    expect(current(data, id, 1)).toBe(5);
  }
  const progress = (await auth.getProgress(user.id))!;
  const repeated = await battles.submitTurn(user.id, quick.id, 0, requestId, [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]);
  expect(repeated).toEqual(result);
  expect(await auth.getProgress(user.id)).toEqual(progress);
  await game.setTeamSlot(user.id, 1, raiders[0]);
  expect((await new PostgresAuthRepository(pool).getProgress(user.id))!.selectedTeam[1]).toBe(raiders[0]);
  expect((await pool.query("SELECT count(*)::int AS count FROM battles WHERE user_id = $1 AND mode = 'quick' AND status = 'victory'", [user.id])).rows[0].count).toBe(5);
});

it('usa a equipe congelada da batalha para Jung, mesmo depois de alterar a escalação atual', async () => {
  const user = await player();
  await history(user.id, ['rival-a-base'], 2, ['protagonist-main-base']);
  await history(user.id, ['rival-a-base'], 9, ['protagonist-secondary-base']);
  const [withoutRavi] = await history(user.id, ['rival-a-base'], 1, ['protagonist-secondary-base'], 'quick', 'active');
  await finish(user.id, withoutRavi);
  expect(current(await game.getCharacterUnlocks(user.id), 'rival-a-base', 3)).toBe(2);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).not.toContain('rival-a-base');
  const [withRavi] = await history(user.id, ['rival-a-base'], 1, ['protagonist-main-base'], 'quick', 'active');
  await game.setTeamSlot(user.id, 0, 'protagonist-secondary-base');
  await finish(user.id, withRavi);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).toContain('rival-a-base');
  expect(current(await game.getCharacterUnlocks(user.id), 'rival-a-base', 3)).toBe(3);
});

it('distingue Multiplayer de Batalha rápida e ignora derrotas e vitórias da campanha', async () => {
  const user = await player();
  await history(user.id, ['road-raider-1-base'], 5, undefined, 'campaign');
  await new Promise((resolve) => setTimeout(resolve, 10));
  await history(user.id, ['road-raider-1-base'], 4);
  await history(user.id, ['road-raider-1-base'], 5, undefined, 'multiplayer');
  await history(user.id, ['road-raider-1-base'], 5, undefined, 'quick', 'defeat');
  const before = await game.getCharacterUnlocks(user.id);
  expect(current(before, 'road-raider-1-base', 1)).toBe(4);
  expect(entry(before, 'road-raider-1-base').unlocked).toBe(false);
  expect(entry(before, 'protagonist-main-transformed').campaignAvailable).toBe(false);
  const [last] = await history(user.id, ['road-raider-1-base'], 1, undefined, 'quick', 'active');
  await finish(user.id, last);
  const unlocked = (await auth.getProgress(user.id))!.unlockedUnitIds;
  expect(unlocked).toContain('road-raider-1-base');
  expect(unlocked).not.toContain('protagonist-main-transformed');
});

it('vitórias rápidas contra personagens não enfrentados na campanha não revelam nem liberam suas missões', async () => {
  const user = await player(1);
  await history(user.id, ['rival-a-base'], 15);
  await history(user.id, ['rival-b-base'], 19);
  await history(user.id, ['rival-female-base'], 10);
  await history(user.id, ['protagonist-main-base'], 5);
  await history(user.id, ['rival-b-final-mode', 'legendary-beast-premium'], 30);
  await seedDatabase(pool);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).not.toContain('protagonist-main-transformed');
  const [last] = await history(user.id, ['rival-b-base'], 1, undefined, 'quick', 'active');
  await finish(user.id, last);
  const unlocked = (await auth.getProgress(user.id))!.unlockedUnitIds;
  expect(unlocked).not.toContain('protagonist-main-transformed');
  expect(unlocked).not.toContain('rival-b-final-mode');
  expect(unlocked).not.toContain('legendary-beast-premium');
  expect(unlocked).not.toContain('rival-b-base');
});

it('mesmo a quinquagésima vitória não revela Ravi Berserk sem derrotá-lo como adversário na campanha', async () => {
  const user = await player();
  await history(user.id, ['rival-a-base', 'rival-b-base', 'rival-female-base'], 49);
  await seedDatabase(pool);
  expect(entry(await game.getCharacterUnlocks(user.id), 'protagonist-main-transformed').campaignAvailable).toBe(false);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).not.toContain('protagonist-main-transformed');
  const [last] = await history(user.id, ['protagonist-main-base'], 1, undefined, 'quick', 'active');
  await finish(user.id, last);
  expect(entry(await game.getCharacterUnlocks(user.id), 'protagonist-main-transformed').campaignAvailable).toBe(false);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).not.toContain('protagonist-main-transformed');
});

it('a décima quinta vitória contra os guerreiros de Espinea libera Trinity, Vlade e Passago', async () => {
  const user = await player();
  const trio = ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c'];
  await history(user.id, trio, 14, ['road-raider-1-base']);
  const before = await game.getCharacterUnlocks(user.id);
  for (const id of trio) {
    expect(entry(before, id).unlocked).toBe(false);
    expect(current(before, id, 1)).toBe(14);
    expect(current(before, id, 2)).toBe(14);
  }
  const [lastQuick] = await history(user.id, trio, 1, ['road-raider-1-base'], 'quick', 'active');
  await finish(user.id, lastQuick);
  const afterQuick = await game.getCharacterUnlocks(user.id);
  for (const id of trio) {
    expect(entry(afterQuick, id).unlocked).toBe(true);
  }
});

it('Passago permanece bloqueado com 14 vitórias rápidas contra ele e desbloqueia na 15ª', async () => {
  const user = await player();
  await history(user.id, ['rival-female-base'], 10, undefined, 'multiplayer');
  await history(user.id, ['guerreiros-habilidosos-c'], 14);
  await seedDatabase(pool);
  const incomplete = await game.getCharacterUnlocks(user.id);
  expect(current(incomplete, 'guerreiros-habilidosos-c', 1)).toBe(14);
  expect(current(incomplete, 'guerreiros-habilidosos-c', 2)).toBe(14);
  expect(entry(incomplete, 'guerreiros-habilidosos-c').unlocked).toBe(false);
  const [last] = await history(user.id, ['guerreiros-habilidosos-c'], 1, undefined, 'quick', 'active');
  await finish(user.id, last);
  expect(entry(await game.getCharacterUnlocks(user.id), 'guerreiros-habilidosos-c').unlocked).toBe(true);
});

it('migra a habilidade de Drak e recalcula o histórico de Espinea com as novas metas', async () => {
  const user = await player();
  const other = await player();
  await history(user.id, ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c'], 15);
  await history(user.id, ['rival-b-base'], 10, undefined, 'multiplayer');
  await pool.query("UPDATE unit_abilities SET ability_id = 'guard' WHERE unit_id = 'passage-guardian-base' AND ability_id = 'female-special'");
  await pool.query("DELETE FROM schema_migrations WHERE name = '012_drak_collective_guard.sql'");
  await migrate(pool);
  await seedDatabase(pool);
  await migrate(pool);
  await seedDatabase(pool);
  expect((await game.getCatalog()).units.find((unit) => unit.id === 'passage-guardian-base')?.abilityIds)
    .toEqual(['main-special', 'fast-move', 'retain-energy', 'extra-turn']);
  const hub = await game.getCharacterUnlocks(user.id);
  for (const id of ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c']) {
    expect(entry(hub, id).unlocked).toBe(true);
    expect((await auth.getProgress(user.id))!.unlockedUnitIds).toContain(id);
  }
  expect((await game.getCatalog()).units.find((unit) => unit.id === 'guerreiros-habilidosos-c')?.unlock.description)
    .toContain('Derrote Passago de Espinea na Batalha rápida 15 vezes.');
  expect((await auth.getProgress(other.id))!.unlockedUnitIds).toEqual([...STARTER_UNIT_IDS]);
});

it('vitórias concorrentes preservam os dois desbloqueios sem duplicar IDs', async () => {
  const user = await player();
  await history(user.id, ['road-raider-1-base'], 4);
  await history(user.id, ['rival-female-base'], 9);
  const [first] = await history(user.id, ['road-raider-1-base'], 1, undefined, 'quick', 'active');
  const [second] = await history(user.id, ['rival-female-base'], 1, undefined, 'quick', 'active');
  await Promise.all([finish(user.id, first), finish(user.id, second)]);
  const unlocked = (await auth.getProgress(user.id))!.unlockedUnitIds;
  expect(unlocked).toContain('road-raider-1-base');
  expect(unlocked).toContain('rival-female-base');
  expect(new Set(unlocked).size).toBe(unlocked.length);
});

it('migra vitórias rápidas antigas e sincroniza suas metas preservando desbloqueios anteriores e outras contas', async () => {
  const user = await player();
  const other = await player();
  await history(user.id, ['road-raider-1-base'], 5);
  await pool.query(`UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', (data->'unlockedUnitIds') || '["passage-guardian-base"]') WHERE user_id = $1`, [user.id]);
  await pool.query('ALTER TABLE battles DROP COLUMN mode');
  await pool.query("DELETE FROM schema_migrations WHERE name = '011_character_unlocks.sql'");
  await migrate(pool);
  await seedDatabase(pool);
  await migrate(pool);
  await seedDatabase(pool);
  const unlocked = (await auth.getProgress(user.id))!.unlockedUnitIds;
  expect(unlocked).toContain('road-raider-1-base');
  expect(unlocked).toContain('passage-guardian-base');
  expect((await auth.getProgress(other.id))!.unlockedUnitIds).toEqual([...STARTER_UNIT_IDS]);
  expect((await pool.query("SELECT count(*)::int AS count FROM battles WHERE user_id = $1 AND mode = 'quick'", [user.id])).rows[0].count).toBe(5);
});

it('expõe progresso somente para a sessão autenticada e a Lista de personagens já recebe o novo desbloqueio', async () => {
  const origin = 'http://127.0.0.1:5173';
  const app = await createApp({ repository: auth, gameRepository: game, battleRepository: battles, origin });
  try {
    expect((await app.inject({ url: '/api/character-unlocks' })).statusCode).toBe(401);
    const registered = await app.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload: { email: 'hub@example.com', password: 'senha longa para testes' } });
    const userId = registered.json().user.id;
    const cookie = `rave_trail_session=${registered.cookies[0].value}`;
    const other = await player();
    await history(other.id, ['road-raider-1-base'], 5);
    const before = await app.inject({ url: `/api/character-unlocks?userId=${other.id}`, headers: { cookie } });
    const beforeCharacters = before.json().unlocks.characters as { id: string; campaignAvailable: boolean; kind: string }[];
    expect(beforeCharacters).toHaveLength(18);
    expect(beforeCharacters.every((unit) => unit.campaignAvailable === (unit.kind === 'premium'
      || unit.id === KALIS_UNIT_ID || unit.id === RIDAN_UNIT_ID))).toBe(true);
    await complete(userId, 1);
    await history(userId, ['road-raider-1-base'], 4);
    const [last] = await history(userId, ['road-raider-1-base'], 1, undefined, 'quick', 'active');
    const snapshot = JSON.parse(JSON.stringify(last.state)) as BattleRecord['state'];
    snapshot.teams.enemy.units[0].hp = 1; snapshot.teams.player.energy = 100;
    await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [last.id, JSON.stringify(snapshot)]);
    const won = await app.inject({ method: 'POST', url: `/api/battles/${last.id}/turns`, headers: { cookie, origin }, payload: {
      revision: 0, requestId: randomUUID(), actions: [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }],
    } });
    expect(won.statusCode).toBe(200);
    expect(won.json()).not.toHaveProperty('unlockedUnitIds');
    const hub = (await app.inject({ url: '/api/character-unlocks', headers: { cookie } })).json().unlocks;
    expect(entry(hub, 'road-raider-1-base').unlocked).toBe(true);
    const progress = (await app.inject({ url: '/api/progress', headers: { cookie } })).json().progress;
    expect(progress.unlockedUnitIds).toContain('road-raider-1-base');
    expect((await app.inject({ method: 'PUT', url: '/api/team/slots/1', headers: { cookie, origin }, payload: { unitId: 'road-raider-1-base' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/character-unlocks', headers: { cookie, origin }, payload: { unlockedUnitIds: ['legendary-beast-premium'] } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { cookie, origin }, payload: { mode: 'multiplayer' } })).statusCode).toBe(400);
  } finally { await app.close(); }
});

it('habilita as metas pelos encontros vencidos e mantém os Premium visíveis', async () => {
  const user = await player();
  await complete(user.id, 0);
  await history(user.id, ['rival-a-base', 'rival-b-base', 'rival-female-base'], 50);
  const initial = await game.getCharacterUnlocks(user.id);
  expect(initial.characters).toHaveLength(18);
  expect(initial.characters.every((unit) => unit.campaignAvailable === (unit.kind === 'premium'
    || unit.id === KALIS_UNIT_ID || unit.id === RIDAN_UNIT_ID))).toBe(true);
  await complete(user.id, 1);
  expect((await game.getCharacterUnlocks(user.id)).characters.filter((unit) => unit.kind === 'battle-wins' && unit.campaignAvailable).map((unit) => unit.id))
    .toEqual([KALIS_UNIT_ID, RIDAN_UNIT_ID, ...encounters[0].enemyUnitIds]);
  await complete(user.id, 2);
  expect((await game.getCharacterUnlocks(user.id)).characters.filter((unit) => unit.kind === 'battle-wins' && unit.campaignAvailable).map((unit) => unit.id)).toEqual([
    KALIS_UNIT_ID, RIDAN_UNIT_ID, ...encounters[0].enemyUnitIds, ...encounters[1].enemyUnitIds,
  ]);
  await complete(user.id, 3);
  const third = await game.getCharacterUnlocks(user.id);
  expect(third.characters.filter((unit) => unit.kind === 'battle-wins' && unit.campaignAvailable)).toHaveLength(11);
  expect(third.characters.some((unit) => unit.id === 'passage-guardian-base')).toBe(true);
  expect(entry(third, 'guerreiros-habilidosos-a').campaignAvailable).toBe(false);
  await complete(user.id, 7);
  const final = await game.getCharacterUnlocks(user.id);
  expect(final.characters.filter((unit) => unit.kind === 'battle-wins' && unit.campaignAvailable)).toHaveLength(16);
  expect(entry(final, 'rival-b-final-mode').kind).toBe('premium');
  expect(entry(final, 'legendary-beast-premium').campaignAvailable).toBe(true);
  expect(entry(final, 'protagonist-main-transformed').campaignAvailable).toBe(true);
});

it('não concede missões ocultas por vitória ou seed e sincroniza a liberação ao vencer o encontro correspondente', async () => {
  const user = await player();
  await complete(user.id, 2);
  const pair = ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b'];
  await history(user.id, pair, 19);
  const [last] = await history(user.id, pair, 1, undefined, 'quick', 'active');
  await finish(user.id, last);
  await seedDatabase(pool);
  expect((await game.getCharacterUnlocks(user.id)).characters.filter((unit) => unit.kind === 'battle-wins' && unit.campaignAvailable)).toHaveLength(8);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).not.toContain('guerreiros-habilidosos-a');
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).not.toContain('guerreiros-habilidosos-b');
  const drak = await battles.startBattle(user.id, encounters[2].id);
  await finish(user.id, drak);
  expect((await game.getCharacterUnlocks(user.id)).characters.filter((unit) => unit.kind === 'battle-wins' && unit.campaignAvailable)).toHaveLength(11);
  const espinea = await battles.startBattle(user.id, encounters[3].id);
  await finish(user.id, espinea);
  const visible = await game.getCharacterUnlocks(user.id);
  expect(entry(visible, 'guerreiros-habilidosos-a').campaignAvailable).toBe(true);
  expect(entry(visible, 'guerreiros-habilidosos-a').unlocked).toBe(false);
  expect(entry(visible, 'guerreiros-habilidosos-b').unlocked).toBe(false);
  expect(entry(visible, 'guerreiros-habilidosos-c').unlocked).toBe(false);
  expect(current(visible, 'guerreiros-habilidosos-a', 1)).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await history(user.id, pair, 15);
  await seedDatabase(pool);
  const earned = await game.getCharacterUnlocks(user.id);
  expect(entry(earned, 'guerreiros-habilidosos-a').unlocked).toBe(true);
  expect(entry(earned, 'guerreiros-habilidosos-b').unlocked).toBe(true);
  expect(entry(earned, 'guerreiros-habilidosos-c').unlocked).toBe(false);
});

it('não conta vitórias rápidas anteriores à revelação do personagem na campanha', async () => {
  const user = await player(0);
  await history(user.id, ['capitao-da-guarda-kalis-base'], 3);
  const raider = 'road-raider-1-base';
  const campaign = await battles.startBattle(user.id, encounters[0].id);
  await finish(user.id, campaign);
  const revealed = await game.getCharacterUnlocks(user.id);
  expect(entry(revealed, raider).campaignAvailable).toBe(true);
  expect(entry(revealed, raider).unlocked).toBe(false);
  expect(current(revealed, raider, 1)).toBe(0);
  expect(current(revealed, raider, 2)).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await history(user.id, [raider], 5);
  const earned = await game.getCharacterUnlocks(user.id);
  expect(current(earned, raider, 1)).toBe(5);
  expect(current(earned, raider, 2)).toBe(3);
  expect(entry(earned, raider).unlocked).toBe(false);
  await seedDatabase(pool);
  expect(entry(await game.getCharacterUnlocks(user.id), raider).unlocked).toBe(true);
});

it('a correção da conta solicitada zera somente missões não reveladas, preserva partidas/equipe e não retorna após o seed', async () => {
  const user = await auth.register('knopmickael@gmail.com', 'hash', session());
  await complete(user.id, 2);
  await game.setTeamSlot(user.id, 1, STARTER_UNIT_IDS[0]);
  await history(user.id, ['rival-a-base', 'rival-b-base', 'rival-female-base'], 3);
  await history(user.id, ['road-raider-1-base'], 2);
  await history(user.id, ['passage-guardian-base'], 4);
  const other = await player();
  await history(other.id, ['rival-a-base'], 2);
  const before = (await auth.getProgress(user.id))!;
  const otherBefore = await auth.getProgress(other.id);
  const battleRows = () => pool.query('SELECT id, state, status, log, revision, updated_at FROM battles WHERE user_id = $1 ORDER BY id', [user.id]);
  const originalBattles = (await battleRows()).rows;
  const rawProgress = async () => {
    const progress = (await auth.getProgress(user.id))!;
    const rows = await pool.query<{ mode: BattleVictory['mode']; state: BattleRecord['state']; updated_at: Date }>(
      "SELECT mode, state, updated_at FROM battles WHERE user_id = $1 AND status = 'victory' AND mode IN ('quick','multiplayer')", [user.id]);
    const victories = rows.rows.map((battle) => ({ mode: battle.mode, completedAt: battle.updated_at.toISOString(),
      playerUnitIds: battle.state.teams.player.units.map((unit) => unit.unitId),
      enemyUnitIds: battle.state.teams.enemy.units.map((unit) => unit.unitId) }));
    return characterUnlockProgress(units, progress.unlockedUnitIds, victories, progress.missionProgressResets);
  };
  const countersBefore = await rawProgress();
  await pool.query("DELETE FROM schema_migrations WHERE name = '019_unseen_mission_progress_reset.sql'");
  await migrate(pool);
  const { missionProgressResets, ...preserved } = (await auth.getProgress(user.id))!;
  expect(preserved).toEqual(before);
  expect(Object.keys(missionProgressResets!)).toHaveLength(26);
  const countersAfter = await rawProgress();
  for (const unit of countersAfter.characters) {
    if (unit.kind !== 'battle-wins') continue;
    if (missionProgressResets![unit.id]) expect(unit.requirements.every((requirement) => requirement.current === 0)).toBe(true);
    else expect(unit).toEqual(entry(countersBefore, unit.id));
  }
  expect((await battleRows()).rows).toEqual(originalBattles);
  expect(await auth.getProgress(other.id)).toEqual(otherBefore);
  await migrate(pool);
  await seedDatabase(pool);
  expect((await auth.getProgress(user.id))!.missionProgressResets).toEqual(missionProgressResets);
  await complete(user.id, 4);
  expect(current(await game.getCharacterUnlocks(user.id), 'guerreiros-habilidosos-a', 1)).toBe(0);
  const [newVictory] = await history(user.id, ['rival-a-base'], 1, undefined, 'quick', 'active');
  await finish(user.id, newVictory);
  await seedDatabase(pool);
  const updated = await game.getCharacterUnlocks(user.id);
  expect(current(updated, 'guerreiros-habilidosos-a', 1)).toBe(1);
  expect(current(updated, 'rival-a-base', 2)).toBe(4);
  expect(current(await game.getCharacterUnlocks(other.id), 'guerreiros-habilidosos-a', 1)).toBe(2);
});
