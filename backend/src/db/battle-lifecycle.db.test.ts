import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashSessionToken } from '../auth/crypto.js';
import { STARTER_UNIT_IDS } from '@game/content/units.js';
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
const battles = new PostgresBattleRepository(pool);
const retain = [{ actorId: 'player-0', abilityId: 'retain-energy' }];
const session = () => ({ tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60000) });
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

async function player() {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', session());
  for (const [slot, unitId] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, unitId);
  return user;
}

it.each(['campaign', 'quick'])('desistência em %s é definitiva, idempotente e não concede progresso', async (mode) => {
  const user = await player();
  const before = await auth.getProgress(user.id);
  const first = mode === 'quick' ? await battles.startQuickBattle(user.id) : await battles.startBattle(user.id, 'path-1-encounter-1');
  const abandoned = await battles.abandonBattle(user.id, first.id);
  expect(abandoned.state.status).toBe('abandoned');
  expect(abandoned.revision).toBe(1);
  expect(abandoned.log?.at(-1)?.message).toContain('desistência');
  expect(await battles.abandonBattle(user.id, first.id)).toEqual(abandoned);
  await expect(battles.submitTurn(user.id, first.id, 0, randomUUID(), retain)).rejects.toMatchObject({ statusCode: 409 });
  await expect(battles.submitTurn(user.id, first.id, 1, randomUUID(), retain)).rejects.toThrow(/terminou/);
  expect(await auth.getProgress(user.id)).toEqual(before);
  const second = mode === 'quick' ? await battles.startQuickBattle(user.id) : await battles.startBattle(user.id, 'path-1-encounter-1');
  expect(second.id).not.toBe(first.id);
  expect(second.state.teams.player.energy).toBe(15);
  expect(second.state.teams.player.units.every((unit) => unit.hp === unit.maxHp)).toBe(true);
  expect((await battles.getMap(user.id, 'path-1')).encounters[0].activeBattleId).toBeNull();
});

it('uma nova partida encerra a anterior em vez de retomar o estado existente', async () => {
  const user = await player();
  const first = await battles.startBattle(user.id, 'path-1-encounter-1');
  await battles.submitTurn(user.id, first.id, 0, randomUUID(), retain);
  const second = await battles.startBattle(user.id, 'path-1-encounter-1');
  const old = await battles.getBattle(user.id, first.id);
  expect(old.state.status).toBe('abandoned');
  expect(old.log?.at(-1)?.message).toContain('nova partida');
  expect(second.id).not.toBe(first.id);
  expect(second.revision).toBe(0);
  expect(second.state.turn).toBe(1);
  expect(second.state.teams.player.units.every((unit) => unit.hp === unit.maxHp)).toBe(true);
  await battles.startQuickBattle(user.id);
  expect((await battles.getBattle(user.id, second.id)).state.status).toBe('abandoned');
});

it('mantém o registro completo no banco e não duplica eventos ao reenviar o turno', async () => {
  const user = await player();
  const first = await battles.startQuickBattle(user.id);
  const historical = Array.from({ length: 150 }, (_, index) => ({ kind: 'turn', message: `Evento anterior ${index + 1}` }));
  await pool.query('UPDATE battles SET log = $2 WHERE id = $1', [first.id, JSON.stringify(historical)]);
  const requestId = randomUUID();
  const response = await battles.submitTurn(user.id, first.id, 0, requestId, retain);
  expect(response.battle.log).toEqual([...historical, ...response.events]);
  expect(response.battle.log?.[0].message).toBe('Evento anterior 1');
  expect(await battles.submitTurn(user.id, first.id, 0, requestId, retain)).toEqual(response);
  expect(await new PostgresBattleRepository(pool).getBattle(user.id, first.id)).toEqual(response.battle);
});

it('recupera registros antigos de todos os comandos na ordem de revisão durante a migração', async () => {
  const user = await player();
  const first = await battles.startQuickBattle(user.id);
  const firstTurn = await battles.submitTurn(user.id, first.id, 0, randomUUID(), retain);
  await pool.query("UPDATE battles SET bot_acts_at = now() - interval '1 second' WHERE id = $1", [first.id]);
  const afterBot = await battles.getBattle(user.id, first.id);
  const secondTurn = await battles.submitTurn(user.id, first.id, afterBot.revision, randomUUID(), retain);
  await pool.query('ALTER TABLE battles DROP COLUMN log');
  await pool.query("DELETE FROM schema_migrations WHERE name = '014_battle_log_and_abandon.sql'");
  await migrate(pool);
  const restored = await battles.getBattle(user.id, first.id);
  expect(restored.log).toEqual([...firstTurn.events, ...secondTurn.events]);
  await migrate(pool);
  expect((await battles.getBattle(user.id, first.id)).log).toEqual(restored.log);
});

it('serializa turno e desistência concorrentes e mantém o resultado de desistência', async () => {
  const user = await player();
  const first = await battles.startQuickBattle(user.id);
  const results = await Promise.allSettled([
    battles.submitTurn(user.id, first.id, 0, randomUUID(), retain),
    battles.abandonBattle(user.id, first.id),
  ]);
  expect(results[1].status).toBe('fulfilled');
  const final = await battles.getBattle(user.id, first.id);
  expect(final.state.status).toBe('abandoned');
  expect(final.log?.filter((event) => event.message.includes('desistência'))).toHaveLength(1);
  expect((await auth.getProgress(user.id))!.unlockedUnitIds).toEqual([...STARTER_UNIT_IDS]);
});

it('protege a desistência HTTP por sessão, origem, proprietário e formato do comando', async () => {
  const origin = 'http://127.0.0.1:5173';
  const app = await createApp({ repository: auth, gameRepository: game, battleRepository: battles, origin });
  try {
    const registered = await app.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload: { email: 'desistir@example.com', password: 'senha longa de teste' } });
    const userId = registered.json().user.id;
    const cookie = `rave_trail_session=${registered.cookies[0].value}`;
    await game.setTeamSlot(userId, 0, STARTER_UNIT_IDS[0]);
    const battle = await battles.startQuickBattle(userId);
    const route = `/api/battles/${battle.id}/abandon`;
    expect((await app.inject({ method: 'POST', url: route, headers: { origin }, payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: route, headers: { origin: 'https://externo.example', cookie }, payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: route, headers: { origin, cookie }, payload: { status: 'victory' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/battles/invalido/abandon', headers: { origin, cookie }, payload: {} })).statusCode).toBe(400);
    const other = await player();
    await expect(battles.abandonBattle(other.id, battle.id)).rejects.toMatchObject({ statusCode: 404 });
    const response = await app.inject({ method: 'POST', url: route, headers: { origin, cookie }, payload: {} });
    expect(response.statusCode).toBe(200);
    expect(response.json().battle.state.status).toBe('abandoned');
    expect((await app.inject({ method: 'POST', url: route, headers: { origin, cookie }, payload: {} })).json()).toEqual(response.json());
  } finally { await app.close(); }
});
