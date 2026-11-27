import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { STARTER_UNIT_IDS } from '@game/content/units.js';
import type { MultiplayerCommand, MultiplayerInput, MultiplayerView } from '@game/multiplayer.js';
import { PostgresMultiplayer } from './multiplayer.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { migrate } from './test-migrations.js';
import { seedDatabase } from './seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo de testes obrigatório.');
const pool = new pg.Pool({ connectionString: url });
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
let now = Date.now();
let service: PostgresMultiplayer;
const views = new Map<string, MultiplayerView>();
async function player() {
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(now + 3600000) });
  for (const [slot, id] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, id);
  accept(await service.connect(user.id, user.id));
  return user.id;
}
function accept(updates: Awaited<ReturnType<PostgresMultiplayer['connect']>>) {
  for (const update of updates) views.set(update.userId, update.view);
}
async function send(userId: string, command: MultiplayerInput) {
  accept(await service.command(userId, userId, { ...command, requestId: randomUUID() } as MultiplayerCommand));
  return views.get(userId)!;
}
async function match() {
  const a = await player(); const b = await player();
  await send(a, { type: 'join' }); await send(b, { type: 'join' });
  const id = views.get(a)!.matchId!;
  await send(a, { type: 'ready', matchId: id }); await send(b, { type: 'ready', matchId: id });
  return { a, b, id };
}
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE'); now = Date.now(); views.clear();
  service = new PostgresMultiplayer(pool, { now: () => now, randomIndex: () => 0 });
});
afterAll(async () => { await pool.end(); });

it('forma partida FIFO com três unidades, aguarda ambos e congela equipes', async () => {
  const a = await player(); const b = await player();
  expect((await send(a, { type: 'join' })).phase).toBe('queued');
  await send(a, { type: 'join' });
  await send(b, { type: 'join' });
  const id = views.get(a)!.matchId!;
  expect(views.get(a)!.phase).toBe('preparing');
  expect(views.get(a)!.mySide).toBe('player');
  expect(views.get(b)!.mySide).toBe('enemy');
  await game.setTeamSlot(a, 0, null);
  await send(a, { type: 'ready', matchId: id });
  expect(views.get(a)!.battle!.turnDeadlineAt).toBeNull();
  await send(b, { type: 'ready', matchId: id });
  expect(views.get(a)!.phase).toBe('active');
  expect(views.get(a)!.battle!.state.teams.player.units.map((unit) => unit.unitId)).toEqual([...STARTER_UNIT_IDS]);
  expect(Date.parse(views.get(a)!.battle!.turnDeadlineAt!) - now).toBe(45000);
});

it('rejeita equipe incompleta, partida contra bot ativa e início de bot durante reserva PvP', async () => {
  const a = await player();
  await game.setTeamSlot(a, 0, null);
  await expect(send(a, { type: 'join' })).rejects.toMatchObject({ statusCode: 400 });
  await game.setTeamSlot(a, 0, STARTER_UNIT_IDS[0]);
  const bot = new PostgresBattleRepository(pool);
  const battle = await bot.startQuickBattle(a);
  await expect(send(a, { type: 'join' })).rejects.toMatchObject({ statusCode: 409 });
  await bot.abandonBattle(a, battle.id);
  await send(a, { type: 'join' });
  await expect(bot.startQuickBattle(a)).rejects.toMatchObject({ statusCode: 409 });
});

it('sincroniza edições, deduplica comandos e rejeita versão vencida e lado errado', async () => {
  const { a, b, id } = await match();
  const command: MultiplayerCommand = { type: 'draft', requestId: randomUUID(), matchId: id, revision: 0, draftRevision: 0,
    actions: [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }] };
  accept(await service.command(a, a, command));
  expect(views.get(b)!.battle!.combo!.actions).toHaveLength(1);
  accept(await service.command(a, a, command));
  expect(views.get(a)!.draftRevision).toBe(1);
  await expect(service.command(b, b, { ...command, requestId: randomUUID(), draftRevision: 1 })).rejects.toMatchObject({ statusCode: 403 });
  await expect(service.command(a, a, { ...command, requestId: randomUUID() })).rejects.toMatchObject({ statusCode: 409 });
  await send(a, { type: 'draft', matchId: id, revision: 0, draftRevision: 1, actions: [] });
  expect(views.get(b)!.battle!.combo!.actions).toEqual([]);
});

it('executa turno uma única vez e deixa o segundo jogador jogar', async () => {
  const { a, b, id } = await match();
  await send(a, { type: 'draft', matchId: id, revision: 0, draftRevision: 0,
    actions: [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }] });
  const command: MultiplayerCommand = { type: 'turn', requestId: randomUUID(), matchId: id, revision: 0, draftRevision: 1 };
  accept(await service.command(a, a, command));
  const hp = views.get(b)!.battle!.state.teams.enemy.units[0].hp;
  accept(await service.command(a, a, command));
  expect(views.get(b)!.battle!.state.teams.enemy.units[0].hp).toBe(hp);
  expect(views.get(b)!.battle!.state.activeSide).toBe('enemy');
  await send(b, { type: 'turn', matchId: id, revision: 1, draftRevision: 2 });
  expect(views.get(a)!.battle!.state.activeSide).toBe('player');
});

it('prazo esgotado descarta combo sem dano e sem depender do cliente', async () => {
  const { a, b, id } = await match();
  await send(a, { type: 'draft', matchId: id, revision: 0, draftRevision: 0,
    actions: [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }] });
  const hp = views.get(b)!.battle!.state.teams.enemy.units[0].hp;
  now += 45001; accept(await service.tick());
  expect(views.get(b)!.battle!.state.teams.enemy.units[0].hp).toBe(hp);
  expect(views.get(b)!.battle!.state.activeSide).toBe('enemy');
  expect(views.get(b)!.battle!.combo!.actions).toEqual([]);
});

it('desistência grava resumo único e remove estado e comandos temporários', async () => {
  const { a, b, id } = await match();
  await Promise.all([send(a, { type: 'surrender', matchId: id }), send(a, { type: 'surrender', matchId: id })]);
  expect(views.get(b)!.result).toMatchObject({ winnerId: b, loserId: a, reason: 'surrender', totalTurns: 0, rounds: 1 });
  expect((await pool.query('SELECT count(*)::int AS n FROM multiplayer_matches')).rows[0].n).toBe(0);
  expect((await pool.query('SELECT count(*)::int AS n FROM multiplayer_commands')).rows[0].n).toBe(0);
  const rows = await pool.query('SELECT data FROM multiplayer_results WHERE id=$1', [id]);
  expect(rows.rows).toHaveLength(1);
  expect(rows.rows[0].data).not.toHaveProperty('battle');
  expect(rows.rows[0].data.teams[a]).toEqual([...STARTER_UNIT_IDS]);
  const outsider = await player();
  await expect(send(outsider, { type: 'sync', matchId: id })).rejects.toMatchObject({ statusCode: 404 });
});

it('reconecta em 10 segundos e ignora fechamento de conexão antiga', async () => {
  const { a, b } = await match();
  accept(await service.disconnect(a, a)); now += 9000;
  accept(await service.connect(a, 'new'));
  accept(await service.disconnect(a, a)); now += 2000; accept(await service.tick());
  expect(views.get(b)!.phase).toBe('active');
  accept(await service.disconnect(a, 'new')); now += 10001; accept(await service.tick());
  expect(views.get(b)!.result).toMatchObject({ winnerId: b, loserId: a, reason: 'disconnect' });
});

it('anula desconexão dupla e reinício de infraestrutura sem vitórias artificiais', async () => {
  const { a, b, id } = await match();
  accept(await service.disconnect(a, a)); accept(await service.disconnect(b, b));
  now += 10001; accept(await service.tick());
  expect((await pool.query('SELECT data FROM multiplayer_results WHERE id=$1', [id])).rows[0].data).toMatchObject({ winnerId: null, loserId: null, reason: 'void' });
  const next = await match();
  await service.initialize();
  expect((await pool.query('SELECT data FROM multiplayer_results WHERE id=$1', [next.id])).rows[0].data.reason).toBe('void');
});

it('cancelamento e busca concorrentes não produzem automatch ou duas reservas', async () => {
  const a = await player(); const b = await player(); const c = await player();
  await Promise.all([send(a, { type: 'join' }), send(a, { type: 'join' }), send(b, { type: 'join' }), send(c, { type: 'join' })]);
  expect((await pool.query('SELECT count(*)::int AS n FROM multiplayer_matches')).rows[0].n).toBe(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM multiplayer_entries')).rows[0].n).toBe(3);
});

it('desistir no prazo do turno continua sendo derrota, não apenas passagem de vez', async () => {
  const { a, b, id } = await match();
  now += 45001;
  await send(a, { type: 'surrender', matchId: id });
  expect(views.get(b)!.result).toMatchObject({ winnerId: b, loserId: a, reason: 'surrender' });
});

it('vitória por combate conta o turno final e mantém equipes nos resumos', async () => {
  const { a, b, id } = await match();
  const row = (await pool.query('SELECT data FROM multiplayer_matches WHERE id=$1', [id])).rows[0].data;
  row.battle.state.teams.enemy.units.forEach((unit: { hp: number }, index: number) => { unit.hp = index === 0 ? 1 : 0; });
  await pool.query('UPDATE multiplayer_matches SET data=$2 WHERE id=$1', [id, JSON.stringify(row)]);
  await send(a, { type: 'draft', matchId: id, revision: 0, draftRevision: 0,
    actions: [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }] });
  await send(a, { type: 'turn', matchId: id, revision: 0, draftRevision: 1 });
  expect(views.get(b)!.result).toMatchObject({ winnerId: a, loserId: b, reason: 'combat', totalTurns: 1, rounds: 1 });
  const unlocks = await game.getCharacterUnlocks(a);
  expect(unlocks.characters.length).toBeGreaterThan(0);
  expect((await pool.query('SELECT count(*)::int AS n FROM multiplayer_commands')).rows[0].n).toBe(0);
});

it('sorteia o segundo inscrito como primeiro lado sem trocar IDs de lutadores', async () => {
  service = new PostgresMultiplayer(pool, { now: () => now, randomIndex: () => 1 });
  const { a, b } = await match();
  expect(views.get(a)!.mySide).toBe('enemy');
  expect(views.get(b)!.mySide).toBe('player');
  expect(views.get(a)!.battle!.state.activeSide).toBe('player');
});

it('turnos extras não criam rodada nova e cada turno executado é contabilizado', async () => {
  const { a, b, id } = await match();
  const row = (await pool.query('SELECT data FROM multiplayer_matches WHERE id=$1', [id])).rows[0].data;
  row.battle.state.teams.player.extraTurns = 1;
  await pool.query('UPDATE multiplayer_matches SET data=$2 WHERE id=$1', [id, JSON.stringify(row)]);
  await send(a, { type: 'turn', matchId: id, revision: 0, draftRevision: 0 });
  expect(views.get(a)!.battle!.state.activeSide).toBe('player');
  await send(a, { type: 'turn', matchId: id, revision: 1, draftRevision: 1 });
  await send(b, { type: 'turn', matchId: id, revision: 2, draftRevision: 2 });
  await send(a, { type: 'surrender', matchId: id });
  expect(views.get(b)!.result).toMatchObject({ rounds: 2, totalTurns: 3 });
});

it('preparação expirada anula sem vencedor e libera as duas reservas', async () => {
  const a = await player(); const b = await player();
  await send(a, { type: 'join' }); await send(b, { type: 'join' });
  now += 20001; accept(await service.tick());
  expect(views.get(a)!.result).toMatchObject({ reason: 'void', winnerId: null });
  expect((await pool.query('SELECT count(*)::int AS n FROM multiplayer_entries')).rows[0].n).toBe(0);
});

it('reconexão tardia não reabre partida após tolerância mesmo antes do próximo tick', async () => {
  const { a, b } = await match();
  accept(await service.disconnect(a, a)); now += 10001;
  accept(await service.connect(a, 'late'));
  expect(views.get(b)!.result).toMatchObject({ winnerId: b, loserId: a, reason: 'disconnect' });
});

it('cancelamento concorrente ao match produz estado consistente sem usuário em duas posições', async () => {
  const a = await player(); const b = await player();
  await send(a, { type: 'join' });
  await Promise.all([send(a, { type: 'cancel' }), send(b, { type: 'join' })]);
  const entries = (await pool.query('SELECT user_id,match_id FROM multiplayer_entries')).rows;
  const matches = (await pool.query('SELECT id FROM multiplayer_matches')).rows;
  expect(new Set(entries.map((entry) => entry.user_id)).size).toBe(entries.length);
  if (matches.length) expect(entries.filter((entry) => entry.match_id === matches[0].id)).toHaveLength(2);
  else expect(entries.map((entry) => entry.user_id)).toEqual([b]);
});
