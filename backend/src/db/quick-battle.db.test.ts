import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashSessionToken } from '../auth/crypto.js';
import { STARTER_UNIT_IDS } from '@game/content/units.js';
import { encounters } from '@game/content/encounters.js';
import type { BattleRecord } from '@game/core/battle.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL deve apontar para um banco exclusivo cujo nome termine em _test, diferente de DATABASE_URL.');
}
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
const battles = new PostgresBattleRepository(pool);
const session = () => ({ tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60000) });

beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

async function complete(userId: string, count: number) {
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{completedEncounters}', $2::jsonb) WHERE user_id = $1",
    [userId, JSON.stringify(encounters.slice(0, count).map((entry) => entry.id))]);
}

async function readyPlayer(count = 3) {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', session());
  await complete(user.id, count);
  for (const [slot, id] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, id);
  return user;
}

it('disponibiliza protagonistas desde o início e acrescenta somente inimigos já vencidos por conta', async () => {
  const user = await readyPlayer(2);
  const other = await auth.register('outra@example.com', 'hash', session());
  const initial = await battles.getQuickBattle(user.id);
  expect(initial.opponents.map((unit) => unit.id)).toEqual([...STARTER_UNIT_IDS, ...encounters[0].enemyUnitIds, ...encounters[1].enemyUnitIds]);
  expect(initial.opponents.every((unit) => unit.name && unit.portrait)).toBe(true);
  expect((await battles.getQuickBattle(other.id)).opponents.map((unit) => unit.id)).toEqual([...STARTER_UNIT_IDS]);
  await complete(user.id, 3);
  const expanded = await battles.getQuickBattle(user.id);
  expect(new Set(expanded.opponents.map((unit) => unit.id))).toEqual(new Set([...STARTER_UNIT_IDS, ...encounters.slice(0, 3).flatMap((entry) => entry.enemyUnitIds)]));
  expect(new Set(expanded.opponents.map((unit) => unit.id)).size).toBe(12);
  expect(initial.opponents.some((unit) => unit.id === 'passage-guardian-base')).toBe(false);
  expect(expanded.opponents.some((unit) => unit.id === 'passage-guardian-base')).toBe(true);
});

it('permite jogar antes da campanha, mas rejeita equipe vazia ou personagem bloqueado', async () => {
  const user = await auth.register('bloqueios@example.com', 'hash', session());
  await expect(battles.startQuickBattle(user.id)).rejects.toMatchObject({ statusCode: 400 });
  await pool.query("UPDATE player_team_slots SET unit_id = 'passage-guardian-base' WHERE user_id = $1 AND slot_index = 0", [user.id]);
  await expect(battles.startQuickBattle(user.id)).rejects.toMatchObject({ statusCode: 403 });
  expect((await pool.query('SELECT count(*)::int AS count FROM battles WHERE user_id = $1', [user.id])).rows[0].count).toBe(0);
  await game.setTeamSlot(user.id, 0, STARTER_UNIT_IDS[0]);
  const quick = await battles.startQuickBattle(user.id);
  expect(new Set(quick.state.teams.enemy.units.map((unit) => unit.unitId))).toEqual(new Set(STARTER_UNIT_IDS));
  expect((await auth.getProgress(user.id))!.completedEncounters).toEqual([]);
});

it('sorteia equipes distintas do conjunto elegível, sem repetições, e congela o sorteio no banco', async () => {
  const user = await readyPlayer();
  const firstDraw = new PostgresBattleRepository(pool, () => 0);
  const lastDraw = new PostgresBattleRepository(pool, (maximum) => maximum - 1);
  const first = await firstDraw.startQuickBattle(user.id);
  const second = await lastDraw.startQuickBattle(user.id);
  expect(first.encounterId).toBeNull();
  expect(second.id).not.toBe(first.id);
  expect(first.state.teams.enemy.units.map((unit) => unit.unitId)).toEqual([...STARTER_UNIT_IDS]);
  expect(second.state.teams.enemy.units.map((unit) => unit.unitId)).toEqual((await battles.getQuickBattle(user.id)).opponents.slice(-3).map((unit) => unit.id).reverse());
  const random = await battles.startQuickBattle(user.id);
  const eligible = new Set((await battles.getQuickBattle(user.id)).opponents.map((unit) => unit.id));
  expect(random.state.teams.enemy.units).toHaveLength(3);
  expect(new Set(random.state.teams.enemy.units.map((unit) => unit.unitId)).size).toBe(3);
  expect(random.state.teams.enemy.units.every((unit) => eligible.has(unit.unitId))).toBe(true);
  expect(random.state.teams.player.energy).toBe(15);
  expect(random.state.teams.enemy.energy).toBe(0);
  expect(random.state.teams.enemy.units.every((unit) => unit.hp === unit.maxHp)).toBe(true);
  await game.setTeamSlot(user.id, 0, null);
  expect(await new PostgresBattleRepository(pool).getBattle(user.id, random.id)).toEqual(random);
});

it('salva vitória e comandos idempotentes sem avançar a campanha, conceder recompensas ou misturar batalhas', async () => {
  const user = await readyPlayer();
  const other = await auth.register('isolamento@example.com', 'hash', session());
  const campaign = await battles.startBattle(user.id, encounters[3].id);
  const mapBefore = await battles.getMap(user.id, 'path-1');
  const progressBefore = await auth.getProgress(user.id);
  const quick = await battles.startQuickBattle(user.id);
  await expect(battles.getBattle(other.id, quick.id)).rejects.toMatchObject({ statusCode: 404 });
  await expect(battles.submitTurn(other.id, quick.id, 0, randomUUID(), [])).rejects.toMatchObject({ statusCode: 404 });
  const snapshot = JSON.parse(JSON.stringify(quick.state)) as BattleRecord['state'];
  snapshot.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
  snapshot.teams.player.energy = 100;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [quick.id, JSON.stringify(snapshot)]);
  const requestId = randomUUID();
  const actions = [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }];
  const outcome = await battles.submitTurn(user.id, quick.id, 0, requestId, actions);
  expect(outcome.battle.state.status).toBe('victory');
  expect(outcome.battle.encounterId).toBeNull();
  expect(await battles.submitTurn(user.id, quick.id, 0, requestId, actions)).toEqual(outcome);
  expect(await battles.getBattle(user.id, quick.id)).toEqual(outcome.battle);
  expect(await auth.getProgress(user.id)).toEqual(progressBefore);
  expect(await battles.getMap(user.id, 'path-1')).toEqual(mapBefore);
  expect((await battles.getBattle(user.id, campaign.id)).state.status).toBe('abandoned');
  const next = await battles.startQuickBattle(user.id);
  expect(next.id).not.toBe(quick.id);
  expect(next.state.teams.player.units.every((unit) => unit.hp === unit.maxHp)).toBe(true);
  expect(next.state.teams.player.energy).toBe(15);
});

it('registra derrota na Batalha rápida e permite uma nova partida com estado inicial', async () => {
  let now = Date.now();
  const timed = new PostgresBattleRepository(pool, () => 0, () => now);
  const user = await readyPlayer(1);
  await game.setTeamSlot(user.id, 1, null);
  await game.setTeamSlot(user.id, 2, null);
  const progressBefore = await auth.getProgress(user.id);
  const quick = await timed.startQuickBattle(user.id);
  quick.state.teams.player.units[0].hp = 1;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [quick.id, JSON.stringify(quick.state)]);
  const outcome = await timed.submitTurn(user.id, quick.id, 0, randomUUID(), []);
  expect(outcome.battle.state.activeSide).toBe('enemy');
  now += 7000;
  expect((await timed.getBattle(user.id, quick.id)).state.status).toBe('defeat');
  expect(await auth.getProgress(user.id)).toEqual(progressBefore);
  const next = await battles.startQuickBattle(user.id);
  expect(next.id).not.toBe(quick.id);
  expect(next.state.teams.player.units[0].hp).toBe(100);
  expect(next.state.teams.player.energy).toBe(15);
});

it('protege as rotas HTTP e recusa adversários ou progresso enviados pelo cliente', async () => {
  const origin = 'http://127.0.0.1:5173';
  const app = await createApp({ repository: auth, gameRepository: game, battleRepository: battles, origin });
  try {
    expect((await app.inject({ url: '/api/quick-battle' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { origin }, payload: {} })).statusCode).toBe(401);
    const registered = await app.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload: { email: 'rapida-http@example.com', password: 'senha longa de teste' } });
    const user = registered.json().user;
    const cookie = `rave_trail_session=${registered.cookies[0].value}`;
    expect((await app.inject({ url: '/api/quick-battle', headers: { cookie } })).json().quickBattle.opponents.map((unit: { id: string }) => unit.id)).toEqual([...STARTER_UNIT_IDS]);
    expect((await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { origin, cookie }, payload: {} })).statusCode).toBe(400);
    await complete(user.id, 2);
    await game.setTeamSlot(user.id, 0, STARTER_UNIT_IDS[0]);
    const available = await app.inject({ url: '/api/quick-battle?userId=outra-conta', headers: { cookie } });
    expect(available.json().quickBattle.opponents.map((unit: { id: string }) => unit.id)).toEqual([...STARTER_UNIT_IDS, ...encounters[0].enemyUnitIds, ...encounters[1].enemyUnitIds]);
    for (const payload of [{ enemyUnitIds: ['rival-b-final-mode'] }, { completedEncounters: [encounters[6].id] }, { userId: 'outra-conta' }]) {
      expect((await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { origin, cookie }, payload })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { origin: 'https://externo.example', cookie }, payload: {} })).statusCode).toBe(403);
    const started = await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { origin, cookie }, payload: {} });
    expect(started.statusCode).toBe(201);
    const battle = started.json().battle;
    expect(battle.encounterId).toBeNull();
    expect((await app.inject({ url: `/api/battles/${battle.id}`, headers: { cookie } })).json().battle).toEqual(battle);
    const turn = await app.inject({ method: 'POST', url: `/api/battles/${battle.id}/turns`, headers: { origin, cookie },
      payload: { revision: 0, requestId: randomUUID(), actions: [{ actorId: 'player-0', abilityId: 'retain-energy' }] } });
    expect(turn.statusCode).toBe(200);
    expect(turn.json().battle.revision).toBe(1);
  } finally { await app.close(); }
});
