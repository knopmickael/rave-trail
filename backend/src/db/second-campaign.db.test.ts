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
      abilityId: state.teams.player.units[0].abilityIds.includes('simple-strike') ? 'simple-strike' : 'quick-slash', targetId: 'enemy-0' }]);
}

it('libera o mapa e a primeira batalha da campanha 02 somente após vencer a final da primeira', async () => {
  const user = await player();
  await expect(battles.getMap(user.id, 'path-2')).rejects.toMatchObject({ statusCode: 403 });
  await expect(battles.startBattle(user.id, second[0].id)).rejects.toMatchObject({ statusCode: 403 });
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1",
    [user.id, JSON.stringify(first.slice(0, 6).map((entry) => entry.id))]);
  await expect(battles.getMap(user.id, 'path-2')).rejects.toMatchObject({ statusCode: 403 });
  await finish(user.id, await battles.startBattle(user.id, FINAL_ENCOUNTER_ID));
  const map = await battles.getMap(user.id, 'path-2');
  expect(map.campaign).toMatchObject({ id: 'path-2', available: true });
  expect(map.encounters[0]).toMatchObject({ id: second[0].id, available: true });
  await expect(battles.startBattle(user.id, second[0].id)).resolves.toMatchObject({ encounterId: second[0].id });
  expect((await game.getCampaigns(user.id)).map((campaign) => campaign.available)).toEqual([true, true]);
});

it.each([0, 1, 2] as const)('inclui Osiris como convidado no slot %s e preserva equipe e desbloqueios', async (slot) => {
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
  expect(await auth.getProgress(user.id)).toEqual(before);
});

it('aceita Osiris como único convidado e evita duplicação quando já está na equipe', async () => {
  const user = await player(true);
  for (let slot = 0; slot < 3; slot++) await game.setTeamSlot(user.id, slot, null);
  const solo = await battles.startBattle(user.id, SECOND_FINAL_ENCOUNTER_ID, { osirisSlot: 2 });
  expect(solo.state.teams.player.units).toHaveLength(1);
  expect(solo.state.teams.player.units[0]).toMatchObject({ unitId: OSIRIS_UNIT_ID, id: 'player-2' });
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', (data->'unlockedUnitIds') || $2::jsonb) WHERE user_id = $1", [user.id, JSON.stringify([OSIRIS_UNIT_ID])]);
  await expect(game.setTeamSlot(user.id, 0, OSIRIS_UNIT_ID)).resolves.toEqual([OSIRIS_UNIT_ID, null, null]);
  await game.setTeamSlot(user.id, 1, STARTER_UNIT_IDS[1]);
  const moved = await battles.startBattle(user.id, SECOND_FINAL_ENCOUNTER_ID, { osirisSlot: 2 });
  expect(moved.state.teams.player.units.map((unit) => unit.unitId)).toEqual([STARTER_UNIT_IDS[1], OSIRIS_UNIT_ID]);
  expect(moved.state.teams.player.units.filter((unit) => unit.unitId === OSIRIS_UNIT_ID)).toHaveLength(1);
  expect((await auth.getProgress(user.id))!.selectedTeam).toEqual([OSIRIS_UNIT_ID, STARTER_UNIT_IDS[1], null]);
});

it('exibe personagens e missões da campanha 02 sem concedê-los antes da revelação na campanha', async () => {
  const user = await player();
  await pool.query('UPDATE player_progress SET data = data || $2::jsonb WHERE user_id = $1', [user.id,
    JSON.stringify({ completedEncounters: first.map((entry) => entry.id), availablePathIds: ['path-1', 'path-2'] })]);
  const template = await battles.startQuickBattle(user.id);
  const state = structuredClone(template.state); state.status = 'victory';
  state.teams.enemy.units.forEach((unit) => { unit.hp = 0; });
  await pool.query(`INSERT INTO battles (id, user_id, encounter_id, state, status, mode)
    SELECT gen_random_uuid(), $1, NULL, $2::jsonb, 'victory', 'quick' FROM generate_series(1, 100)`, [user.id, JSON.stringify(state)]);
  const missions = (await game.getCharacterUnlocks(user.id)).characters.filter((unit) => SECOND_CAMPAIGN_UNIT_IDS.includes(unit.id as typeof SECOND_CAMPAIGN_UNIT_IDS[number]));
  expect(missions).toHaveLength(17);
  expect(missions.filter((unit) => unit.kind === 'battle-wins').every((unit) => !unit.campaignAvailable)).toBe(true);
  const after = (await auth.getProgress(user.id))!;
  for (const id of SECOND_CAMPAIGN_UNIT_IDS) expect(after.unlockedUnitIds).not.toContain(id);
  const catalog = await game.getCatalog();
  expect(catalog.units).toHaveLength(units.length);
  for (const id of SECOND_CAMPAIGN_UNIT_IDS) expect(catalog.units.some((unit) => unit.id === id)).toBe(true);
  const disabled = await pool.query('SELECT id FROM units WHERE NOT enabled');
  expect(disabled.rows).toHaveLength(0);
  const enemies = await pool.query('SELECT 1 FROM encounter_enemies e JOIN units u ON u.id=e.unit_id WHERE NOT u.enabled');
  expect(enemies.rowCount).toBe(0);
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

it('executa as migrações e o seed novamente preservando equipe e publicação da campanha 02', async () => {
  const user = await player();
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1", [user.id, JSON.stringify(first.map((entry) => entry.id))]);
  const before = (await auth.getProgress(user.id))!;
  await migrate(pool); await seedDatabase(pool);
  const after = (await auth.getProgress(user.id))!;
  expect(after).toEqual(before);
  await migrate(pool); await seedDatabase(pool);
  expect(await auth.getProgress(user.id)).toEqual(after);
  expect((await game.getCatalog()).units).toHaveLength(units.length);
  expect((await battles.getMap(user.id, 'path-2')).campaign.available).toBe(true);
});
