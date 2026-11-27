import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { STARTER_UNIT_IDS } from '@game/content/units.js';
import type { MultiplayerMessage } from '@game/multiplayer.js';
import { createApp } from '../app.js';
import { hashSessionToken } from '../auth/crypto.js';
import { PostgresMultiplayer } from './multiplayer.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { migrate } from './test-migrations.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo de testes obrigatório.');
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
const service = new PostgresMultiplayer(pool);
const origin = 'http://localhost:5173';
let app: Awaited<ReturnType<typeof createApp>>;
const sockets: WebSocket[] = [];
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE');
  app = await createApp({ repository: auth, gameRepository: game, multiplayer: service, origin });
  await app.ready();
});
afterAll(async () => { await pool.end(); });
async function account() {
  const token = randomUUID();
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3600000) });
  for (const [slot, id] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, id);
  return { user, cookie: `rave_trail_session=${token}`, token };
}
async function client(cookie: string) {
  const ws = await app.injectWS('/api/multiplayer/live', { headers: { origin, cookie } });
  sockets.push(ws);
  const messages: MultiplayerMessage[] = [];
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  const wait = async (predicate: (message: MultiplayerMessage) => boolean) => {
    await expect.poll(() => messages.some(predicate), { timeout: 3000 }).toBe(true);
    return messages.find(predicate)!;
  };
  return { ws, messages, wait };
}

it('rejeita upgrade sem sessão ou com origem indevida', async () => {
  const { cookie } = await account();
  await expect(app.injectWS('/api/multiplayer/live', { headers: { origin } })).rejects.toThrow('401');
  await expect(app.injectWS('/api/multiplayer/live', { headers: { origin: 'https://other.invalid', cookie } })).rejects.toThrow('403');
  await app.close();
});

it('dois sockets autenticados encontram partida e recebem cada edição aceita', async () => {
  const a = await account(); const b = await account();
  const ca = await client(a.cookie); const cb = await client(b.cookie);
  ca.ws.send(JSON.stringify({ type: 'join', requestId: randomUUID() }));
  await ca.wait((m) => m.type === 'state' && m.view.phase === 'queued');
  cb.ws.send(JSON.stringify({ type: 'join', requestId: randomUUID() }));
  const found = await ca.wait((m) => m.type === 'state' && m.view.phase === 'preparing');
  if (found.type !== 'state') throw new Error('Estado esperado');
  const id = found.view.matchId!;
  ca.ws.send(JSON.stringify({ type: 'ready', requestId: randomUUID(), matchId: id }));
  cb.ws.send(JSON.stringify({ type: 'ready', requestId: randomUUID(), matchId: id }));
  const active = await ca.wait((m) => m.type === 'state' && m.view.phase === 'active');
  if (active.type !== 'state') throw new Error('Estado esperado');
  const acting = active.view.mySide === 'player' ? ca : cb;
  const watching = acting === ca ? cb : ca;
  acting.ws.send(JSON.stringify({ type: 'draft', requestId: randomUUID(), matchId: id, revision: 0, draftRevision: 0,
    actions: [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }] }));
  await watching.wait((m) => m.type === 'state' && m.view.draftRevision === 1 && m.view.battle?.combo?.actions.length === 1);
  acting.ws.send(JSON.stringify({ type: 'draft', requestId: randomUUID(), matchId: id, revision: 0, draftRevision: 1, actions: [] }));
  await watching.wait((m) => m.type === 'state' && m.view.draftRevision === 2 && m.view.battle?.combo?.actions.length === 0);
  acting.ws.send(JSON.stringify({ type: 'surrender', requestId: randomUUID(), matchId: id }));
  await watching.wait((m) => m.type === 'state' && m.view.result?.reason === 'surrender');
  for (const ws of sockets.splice(0)) ws.terminate();
  await app.close();
});

it('valida frames, não expõe credenciais e rejeita sessão revogada em conexão aberta', async () => {
  const a = await account(); const ca = await client(a.cookie);
  ca.ws.send('{invalid');
  await ca.wait((m) => m.type === 'error' && m.status === 400);
  ca.ws.send(JSON.stringify({ type: 'join', requestId: randomUUID(), winnerId: a.user.id }));
  await ca.wait((m) => m.type === 'error' && m.status === 400);
  await auth.deleteSession(hashSessionToken(a.token));
  ca.ws.send(JSON.stringify({ type: 'join', requestId: randomUUID() }));
  await ca.wait((m) => m.type === 'error' && m.status === 401);
  expect(JSON.stringify(ca.messages)).not.toContain(a.user.email);
  ca.ws.terminate(); sockets.splice(0);
  await app.close();
});

it('reconcilia falha de gravação da desconexão sem deixar adversário fantasma elegível', async () => {
  const a = await account(); const ca = await client(a.cookie);
  ca.ws.send(JSON.stringify({ type: 'join', requestId: randomUUID() }));
  await ca.wait((m) => m.type === 'state' && m.view.phase === 'queued');
  vi.spyOn(service, 'disconnect').mockRejectedValueOnce(new Error('database unavailable'));
  ca.ws.terminate();
  await expect.poll(async () => (await pool.query('SELECT count(*)::int AS n FROM multiplayer_entries')).rows[0].n, { timeout: 3500 }).toBe(0);
  vi.restoreAllMocks(); sockets.splice(0);
  await app.close();
});

it('limita comandos pendentes mesmo quando um processamento está bloqueado', async () => {
  const a = await account(); const ca = await client(a.cookie);
  await ca.wait((m) => m.type === 'state');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const original = service.command.bind(service);
  vi.spyOn(service, 'command').mockImplementationOnce(async (...args) => { await gate; return original(...args); });
  const closed = new Promise<number>((resolve) => ca.ws.on('close', (code) => resolve(code)));
  for (let i = 0; i < 25; i++) ca.ws.send(JSON.stringify({ type: 'sync', requestId: randomUUID() }));
  const outcome = await Promise.race([closed, new Promise<number>((resolve) => setTimeout(() => resolve(-1), 500))]);
  release();
  expect(outcome).toBe(1008);
  vi.restoreAllMocks(); sockets.splice(0);
  await app.close();
});
