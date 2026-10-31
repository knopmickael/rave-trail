import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { STARTER_UNIT_IDS, units } from '@game/content/units.js';
import { encounters } from '@game/content/encounters.js';
import { FINAL_BATTLE_REQUIREMENT, FINAL_ENCOUNTER_ID } from '@game/content/campaign-rules.js';
import { BOT_THINK_MS } from '@game/core/battle.js';
import { hashSessionToken } from '../auth/crypto.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL deve apontar para um banco exclusivo cujo nome termine em _test, diferente de DATABASE_URL.');
}
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
let now: number;
let battles: PostgresBattleRepository;
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE');
  now = Date.now();
  battles = new PostgresBattleRepository(pool, () => 0, () => now);
});
afterAll(async () => { await pool.end(); });

async function player() {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', {
    tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60_000),
  });
  for (const [slot, unitId] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, unitId);
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1",
    [user.id, JSON.stringify(encounters.slice(0, 6).map((entry) => entry.id))]);
  return user;
}

it('persiste as equipes aprovadas em ordem e corrige a formação antiga ao reaplicar o seed', async () => {
  const user = await player();
  const before = await auth.getProgress(user.id);
  await pool.query(`INSERT INTO encounter_enemies (encounter_id, slot_index, unit_id)
    VALUES ($1, 1, 'guerreiros-habilidosos-b'), ($1, 2, 'guerreiros-habilidosos-c')`, [FINAL_ENCOUNTER_ID]);
  await seedDatabase(pool);
  await seedDatabase(pool);
  const map = await battles.getMap(user.id, 'path-1');
  expect(map.encounters.map((entry) => entry.enemyUnitIds)).toEqual(encounters.map((entry) => entry.enemyUnitIds));
  expect(await auth.getProgress(user.id)).toEqual(before);
  for (const encounter of encounters) {
    const battle = await battles.startBattle(user.id, encounter.id);
    expect(battle.state.teams.enemy.units.map((unit) => unit.unitId)).toEqual(encounter.enemyUnitIds);
    expect(battle.state.teams.enemy.units.every((unit) => unit.hp === unit.maxHp)).toBe(true);
  }
});

it('exige Ravi base mesmo com Berserk desbloqueado e mantém a equipe de três slots fora do duelo', async () => {
  const user = await player();
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', (data->'unlockedUnitIds') || '[\"protagonist-main-transformed\"]'::jsonb) WHERE user_id = $1", [user.id]);
  await game.setTeamSlot(user.id, 0, 'protagonist-main-transformed');
  const sixth = await battles.startBattle(user.id, encounters[5].id);
  expect(sixth.state.teams.enemy.units).toHaveLength(2);
  await expect(battles.startBattle(user.id, FINAL_ENCOUNTER_ID)).rejects.toThrow(FINAL_BATTLE_REQUIREMENT);
  expect((await battles.getBattle(user.id, sixth.id)).state.status).toBe('active');
  await game.setTeamSlot(user.id, 2, 'protagonist-main-base');
  const selected = (await auth.getProgress(user.id))!.selectedTeam;
  const final = await battles.startBattle(user.id, FINAL_ENCOUNTER_ID);
  expect(final.state.teams.player.units.map((unit) => unit.unitId)).toEqual(['protagonist-main-base']);
  expect(final.state.teams.enemy.units.map((unit) => unit.unitId)).toEqual(['rival-b-final-mode']);
  expect((await auth.getProgress(user.id))!.selectedTeam).toEqual(selected);
  await expect(battles.submitTurn(user.id, final.id, 0, randomUUID(), [{ actorId: 'player-1', abilityId: 'retain-energy' }])).rejects.toThrow(/inválidos/);
  await expect(battles.submitTurn(user.id, final.id, 0, randomUUID(), [{ actorId: 'player-0', abilityId: 'retain-energy-plus' }])).rejects.toThrow(/inválidos/);
});

it('transforma no servidor uma única vez, persiste após recarga e conclui o duelo sem conceder a unidade', async () => {
  const user = await player();
  const progress = await auth.getProgress(user.id);
  const final = await battles.startBattle(user.id, FINAL_ENCOUNTER_ID);
  expect(progress!.unlockedUnitIds).not.toContain('protagonist-main-transformed');
  const requestId = randomUUID();
  const actions = [{ actorId: 'player-0', abilityId: 'retain-energy' }];
  const opening = await battles.submitTurn(user.id, final.id, 0, requestId, actions);
  expect(opening.battle.state.teams.player.units[0].unitId).toBe('protagonist-main-base');
  now += BOT_THINK_MS;
  const [transformed, concurrent] = await Promise.all([battles.getBattle(user.id, final.id), battles.getBattle(user.id, final.id)]);
  expect(concurrent).toEqual(transformed);
  expect(transformed.revision).toBe(2);
  expect(transformed.state.teams.player.units).toHaveLength(1);
  expect(transformed.state.teams.player.units[0]).toMatchObject({ id: 'player-0', unitId: 'protagonist-main-transformed',
    name: 'Ravi Berserk', abilityIds: units.find((unit) => unit.id === 'protagonist-main-transformed')!.abilityIds });
  expect(transformed.log?.filter((event) => event.kind === 'transform')).toHaveLength(1);
  expect(await battles.submitTurn(user.id, final.id, 0, requestId, actions)).toEqual(opening);
  expect(await new PostgresBattleRepository(pool, () => 0, () => now).getBattle(user.id, final.id)).toEqual(transformed);
  transformed.state.teams.enemy.units[0].hp = 1;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [final.id, JSON.stringify(transformed.state)]);
  const victoryId = randomUUID();
  const finishing = [{ actorId: 'player-0', abilityId: 'main-special', targetId: 'enemy-0' }];
  const victory = await battles.submitTurn(user.id, final.id, transformed.revision, victoryId, finishing);
  expect(victory.battle.state.status).toBe('victory');
  expect(await battles.submitTurn(user.id, final.id, transformed.revision, victoryId, finishing)).toEqual(victory);
  const after = await auth.getProgress(user.id);
  expect(after!.completedEncounters).toEqual(encounters.map((entry) => entry.id));
  expect(after!.unlockedUnitIds).toEqual(progress!.unlockedUnitIds);
  expect(after!.selectedTeam).toEqual(progress!.selectedTeam);
  expect((await battles.getBattle(user.id, final.id)).log?.filter((event) => event.kind === 'transform')).toHaveLength(1);
});
