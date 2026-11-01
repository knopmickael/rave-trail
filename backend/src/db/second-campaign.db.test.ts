import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { encounters } from '@game/content/encounters.js';
import { units, STARTER_UNIT_IDS } from '@game/content/units.js';
import { SECOND_CAMPAIGN_UNIT_IDS } from '@game/content/second-campaign.js';
import { FINAL_ENCOUNTER_ID, SECOND_FINAL_ENCOUNTER_ID, OSIRIS_UNIT_ID } from '@game/content/campaign-rules.js';
import type { BattleRecord } from '@game/core/battle.js';
import { hashSessionToken } from '../auth/crypto.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco de testes exclusivo obrigatório.');
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
const battles = new PostgresBattleRepository(pool, () => 0, () => Date.now());
const first = encounters.filter((entry) => entry.campaignId === 'path-1');
const second = encounters.filter((entry) => entry.campaignId === 'path-2');
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

async function player(readyForFinal = false) {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', {
    tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60_000),
  });
  for (const [slot, id] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, id);
  if (readyForFinal) await pool.query('UPDATE player_progress SET data = data || $2::jsonb WHERE user_id = $1', [user.id,
    JSON.stringify({ completedEncounters: [...first, ...second.slice(0, 5)].map((entry) => entry.id), availablePathIds: ['path-1', 'path-2'] })]);
  return user;
}

async function finish(userId: string, battle: BattleRecord, requestId = randomUUID()) {
  const state = structuredClone(battle.state);
  state.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
  state.teams.player.energy = 100;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [battle.id, JSON.stringify(state)]);
  return battles.submitTurn(userId, battle.id, battle.revision, requestId,
    [{ actorId: state.teams.player.units[0].id,
      abilityId: state.teams.player.units[0].abilityIds.includes('simple-strike') ? 'simple-strike' : 'simple-strike-ii', targetId: 'enemy-0' }]);
}

it('libera a campanha 02 após a vitória final da primeira e mantém a progressão sequencial dos seis encontros', async () => {
  const user = await player();
  await expect(battles.getMap(user.id, 'path-2')).rejects.toMatchObject({ statusCode: 403 });
  await expect(battles.startBattle(user.id, second[0].id)).rejects.toMatchObject({ statusCode: 403 });
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1",
    [user.id, JSON.stringify(first.slice(0, 6).map((entry) => entry.id))]);
  await finish(user.id, await battles.startBattle(user.id, FINAL_ENCOUNTER_ID));
  const map = await battles.getMap(user.id, 'path-2');
  expect(map.campaign.title).toBe('Além das Fronteiras');
  expect(map.encounters.map((entry) => entry.enemyUnitIds)).toEqual(second.map((entry) => entry.enemyUnitIds));
  expect(map.encounters.map((entry) => entry.available)).toEqual([true, false, false, false, false, false]);
  await expect(battles.startBattle(user.id, second[1].id)).rejects.toMatchObject({ statusCode: 403 });
  const encounter = await battles.startBattle(user.id, second[0].id);
  expect(encounter.state.teams.enemy.units.map((unit) => unit.unitId)).toEqual(['general-abel', 'guardia-da-fronteira', 'samurai-erlang']);
  await finish(user.id, encounter);
  expect((await battles.getMap(user.id, 'path-2')).encounters[1].available).toBe(true);
});

it.each([0, 1, 2] as const)('inclui Osiris bloqueado como convidado no slot %s e preserva equipe e desbloqueios', async (slot) => {
  const user = await player(true);
  const before = (await auth.getProgress(user.id))!;
  expect(before.unlockedUnitIds).not.toContain(OSIRIS_UNIT_ID);
  await expect(battles.startBattle(user.id, SECOND_FINAL_ENCOUNTER_ID)).rejects.toMatchObject({ statusCode: 400 });
  await expect(battles.startBattle(user.id, SECOND_FINAL_ENCOUNTER_ID, { osirisSlot: 3 as 0 })).rejects.toMatchObject({ statusCode: 400 });
  await expect(battles.startBattle(user.id, second[0].id, { osirisSlot: slot })).rejects.toMatchObject({ statusCode: 400 });
  const battle = await battles.startBattle(user.id, SECOND_FINAL_ENCOUNTER_ID, { osirisSlot: slot });
  const expected = [...STARTER_UNIT_IDS] as string[]; expected[slot] = OSIRIS_UNIT_ID;
  expect(battle.state.teams.player.units.map((unit) => unit.unitId)).toEqual(expected);
  expect(battle.state.teams.player.units[slot].id).toBe(`player-${slot}`);
  expect(battle.state.teams.enemy.units.map((unit) => unit.unitId)).toEqual(['verdadeiro-rei-demonio']);
  expect(battle.state.pendingTransformation).toBeUndefined();
  expect(await auth.getProgress(user.id)).toEqual(before);
  const requestId = randomUUID();
  const won = await finish(user.id, battle, requestId);
  expect(won.battle.state.status).toBe('victory');
  expect((await auth.getProgress(user.id))!.completedEncounters).toContain(SECOND_FINAL_ENCOUNTER_ID);
  expect((await auth.getProgress(user.id))!.selectedTeam).toEqual(before.selectedTeam);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).toEqual(before.unlockedUnitIds);
  await expect(game.setTeamSlot(user.id, slot, OSIRIS_UNIT_ID)).rejects.toMatchObject({ statusCode: 403 });
  expect(await battles.submitTurn(user.id, battle.id, 0, requestId, [])).toEqual(won);
});

it('preserva o slot escolhido com uma equipe vazia e não duplica Osiris se já estiver na equipe', async () => {
  const user = await player(true);
  for (let slot = 0; slot < 3; slot++) await game.setTeamSlot(user.id, slot, null);
  const solo = await battles.startBattle(user.id, SECOND_FINAL_ENCOUNTER_ID, { osirisSlot: 2 });
  expect(solo.state.teams.player.units).toHaveLength(1);
  expect(solo.state.teams.player.units[0]).toMatchObject({ id: 'player-2', unitId: OSIRIS_UNIT_ID });
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', (data->'unlockedUnitIds') || $2::jsonb) WHERE user_id = $1", [user.id, JSON.stringify([OSIRIS_UNIT_ID])]);
  await game.setTeamSlot(user.id, 0, OSIRIS_UNIT_ID);
  await game.setTeamSlot(user.id, 1, STARTER_UNIT_IDS[1]);
  const moved = await battles.startBattle(user.id, SECOND_FINAL_ENCOUNTER_ID, { osirisSlot: 2 });
  expect(moved.state.teams.player.units.map((unit) => unit.id)).toEqual(['player-1', 'player-2']);
  expect(moved.state.teams.player.units.filter((unit) => unit.unitId === OSIRIS_UNIT_ID)).toHaveLength(1);
});

it('cadastra 16 missões de vitórias e Ártemis Premium, liberando apenas personagens gratuitos ao alcançar 100 vitórias rápidas', async () => {
  const user = await player();
  await pool.query('UPDATE player_progress SET data = data || $2::jsonb WHERE user_id = $1', [user.id,
    JSON.stringify({ completedEncounters: [...first, ...second.slice(0, 2)].map((entry) => entry.id), availablePathIds: ['path-1', 'path-2'] })]);
  const template = await battles.startQuickBattle(user.id);
  const state = structuredClone(template.state); state.status = 'victory';
  state.teams.enemy.units.forEach((unit) => { unit.hp = 0; });
  await pool.query(`INSERT INTO battles (id, user_id, encounter_id, state, status, mode)
    SELECT gen_random_uuid(), $1, NULL, $2::jsonb, 'victory', 'quick' FROM generate_series(1, 99)`, [user.id, JSON.stringify(state)]);
  const missions = (await game.getCharacterUnlocks(user.id)).characters.filter((unit) => SECOND_CAMPAIGN_UNIT_IDS.includes(unit.id as typeof SECOND_CAMPAIGN_UNIT_IDS[number]));
  expect(missions).toHaveLength(17);
  expect(missions.filter((unit) => unit.kind === 'battle-wins' && unit.requirements[0].target === 100)).toHaveLength(16);
  expect(missions.find((unit) => unit.id === 'maga-artemis')).toMatchObject({ campaignAvailable: true, unlocked: false,
    kind: 'premium', priceUsd: 9.9 });
  const current = await battles.startQuickBattle(user.id);
  await finish(user.id, current);
  const after = (await auth.getProgress(user.id))!;
  expect(after.unlockedUnitIds).toEqual(expect.arrayContaining(['general-abel', 'grande-rei-osiris']));
  expect(after.unlockedUnitIds).not.toContain('maga-artemis');
  expect(after.unlockedUnitIds).not.toContain('espadachim-lupus');
  const catalog = await game.getCatalog();
  expect(catalog.units.find((unit) => unit.id === 'maga-artemis')?.unlock.kind).toBe('premium');
  expect(catalog.units[31].id).toBe('combatente-demonio');
  expect(catalog.units[33].id).toBe('lorde-demonio-rakin');
  for (const id of SECOND_CAMPAIGN_UNIT_IDS) {
    const unit = catalog.units.find((entry) => entry.id === id)!;
    expect(unit.provisional).toBe(true);
    expect(unit.abilityIds).toEqual(['simple-strike', 'guard', 'retain-energy', 'strong-strike']);
    expect(unit.portrait).toBe(`/media/characters/02/${id}-face.png`);
    expect(missions.find((mission) => mission.id === id)?.portrait).toBe(`/media/characters/02/${id}-face.png`);
  }
});

it('a conta com todos os personagens liberados acessa as missões de Berserk e da Fera sem bloqueios de campanha', async () => {
  const user = await player();
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', $2::jsonb) WHERE user_id = $1", [user.id, JSON.stringify(units.map((unit) => unit.id))]);
  const data = await game.getCharacterUnlocks(user.id);
  for (const id of ['protagonist-main-transformed', 'legendary-beast-premium']) {
    expect(data.characters.find((unit) => unit.id === id)).toMatchObject({ unlocked: true, campaignAvailable: true });
  }
  expect(data.characters.every((unit) => unit.unlocked && unit.campaignAvailable)).toBe(true);
});

it('a migration libera contas que já terminaram a primeira campanha sem alterar a equipe e pode ser reaplicada', async () => {
  const user = await player();
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1", [user.id, JSON.stringify(first.map((entry) => entry.id))]);
  const before = (await auth.getProgress(user.id))!;
  await pool.query('DELETE FROM schema_migrations WHERE name = $1', ['025_second_campaign.sql']);
  await migrate(pool); await seedDatabase(pool);
  const after = (await auth.getProgress(user.id))!;
  expect(after).toEqual({ ...before, availablePathIds: ['path-1', 'path-2'] });
  await migrate(pool); await seedDatabase(pool);
  expect(await auth.getProgress(user.id)).toEqual(after);
  expect((await game.getCatalog()).units).toHaveLength(units.length);
  expect((await battles.getMap(user.id, 'path-2')).encounters).toHaveLength(6);
});
