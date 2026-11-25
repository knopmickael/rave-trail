import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { createApp } from '../app.js';
import { hashSessionToken } from '../auth/crypto.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
let now: number;
let repo: PostgresBattleRepository;
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); now = Date.now(); repo = new PostgresBattleRepository(pool, () => 0, () => now); });
afterAll(async () => { await pool.end(); });
async function player() {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(now + 3600000) });
  await game.setTeamSlot(user.id, 0, 'protagonist-main-base');
  return user.id;
}
async function surrender(userId: string, count: number) {
  let last = '';
  for (let i = 0; i < count; i++) { last = (await repo.startQuickBattle(userId)).id; await repo.abandonBattle(userId, last); }
  return last;
}

it('bloqueia na décima desistência por cinco minutos, persiste e não afeta outra conta', async () => {
  const user = await player(); const other = await player();
  const last = await surrender(user, 9);
  await Promise.all([repo.abandonBattle(user, last), repo.abandonBattle(user, last)]);
  const tenth = await repo.startQuickBattle(user);
  await repo.abandonBattle(user, tenth.id);
  const until = new Date(now + 300000).toISOString();
  expect(await repo.getQuickBattle(user)).toMatchObject({ blockedUntil: until, serverTime: new Date(now).toISOString() });
  await expect(new PostgresBattleRepository(pool, () => 0, () => now).startQuickBattle(user)).rejects.toMatchObject({ statusCode: 429, retryAt: until });
  await expect(repo.startQuickBattle(other)).resolves.toMatchObject({ encounterId: null });
  now += 299999;
  await expect(repo.startQuickBattle(user)).rejects.toMatchObject({ statusCode: 429 });
  now++;
  await expect(repo.startQuickBattle(user)).resolves.toMatchObject({ encounterId: null });
});

it('descarta desistências que completaram cinco minutos e inicia uma janela nova', async () => {
  const user = await player();
  await surrender(user, 9);
  now += 300000;
  await surrender(user, 1);
  expect((await repo.getQuickBattle(user)).blockedUntil).toBeNull();
  await expect(repo.startQuickBattle(user)).resolves.toMatchObject({ encounterId: null });
});

it('iniciar outra rápida conta como desistência e não reverte o bloqueio ao rejeitar a nova partida', async () => {
  const user = await player();
  await repo.startQuickBattle(user);
  for (let i = 0; i < 9; i++) await repo.startQuickBattle(user);
  await expect(repo.startQuickBattle(user)).rejects.toMatchObject({ statusCode: 429 });
  expect((await repo.getQuickBattle(user)).blockedUntil).toBe(new Date(now + 300000).toISOString());
  expect((await pool.query("SELECT count(*)::int AS count FROM battles WHERE user_id=$1 AND status='active'", [user])).rows[0].count).toBe(0);
});

it('desistências de campanha não contam e a campanha continua acessível durante o bloqueio de rápidas', async () => {
  const user = await player();
  for (let i = 0; i < 10; i++) { const battle = await repo.startBattle(user, 'path-1-encounter-1'); await repo.abandonBattle(user, battle.id); }
  expect((await repo.getQuickBattle(user)).blockedUntil).toBeNull();
  await surrender(user, 10);
  await expect(repo.startBattle(user, 'path-1-encounter-1')).resolves.toMatchObject({ encounterId: 'path-1-encounter-1' });
});

it('conta somente uma desistência de uma mesma partida sob concorrência', async () => {
  const user = await player();
  await surrender(user, 8);
  const battle = await repo.startQuickBattle(user);
  await Promise.all(Array.from({ length: 5 }, () => repo.abandonBattle(user, battle.id)));
  expect((await repo.getQuickBattle(user)).blockedUntil).toBeNull();
  const next = await repo.startQuickBattle(user);
  await repo.abandonBattle(user, next.id);
  expect((await repo.getQuickBattle(user)).blockedUntil).toBe(new Date(now + 300000).toISOString());
});

it('duas tentativas simultâneas não contornam a décima desistência implícita', async () => {
  const user = await player();
  await surrender(user, 9);
  await repo.startQuickBattle(user);
  const results = await Promise.allSettled([repo.startQuickBattle(user), repo.startQuickBattle(user)]);
  expect(results.every((r) => r.status === 'rejected' && r.reason.statusCode === 429)).toBe(true);
  expect((await repo.getQuickBattle(user)).blockedUntil).toBe(new Date(now + 300000).toISOString());
});

it('trocar a décima rápida por campanha contabiliza o abandono sem bloquear a campanha', async () => {
  const user = await player();
  await surrender(user, 9);
  await repo.startQuickBattle(user);
  await expect(repo.startBattle(user, 'path-1-encounter-1')).resolves.toMatchObject({ encounterId: 'path-1-encounter-1' });
  await expect(repo.startQuickBattle(user)).rejects.toMatchObject({ statusCode: 429 });
});

it('a API devolve 429 com prazo e relógio do servidor apenas para a conta autenticada', async () => {
  const user = await player();
  const token = 'a'.repeat(64);
  await auth.createSession(user, { tokenHash: hashSessionToken(token), expiresAt: new Date(now + 3600000) });
  await surrender(user, 10);
  const origin = 'http://127.0.0.1:5173';
  const app = await createApp({ repository: auth, gameRepository: game, battleRepository: repo, origin });
  try {
    expect((await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { origin }, payload: {} })).statusCode).toBe(401);
    const response = await app.inject({ method: 'POST', url: '/api/quick-battle/battles', headers: { origin, cookie: `rave_trail_session=${token}` }, payload: {} });
    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ retryAt: new Date(now + 300000).toISOString(), serverTime: new Date(now).toISOString() });
  } finally { await app.close(); }
});
