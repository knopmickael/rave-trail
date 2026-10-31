import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { hashSessionToken } from '../auth/crypto.js';
import { BOT_THINK_MS, TURN_DURATION_MS, previewActions } from '@game/core/battle.js';
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
    tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60000),
  });
  for (const [slot, unitId] of STARTER_UNIT_IDS.entries()) await game.setTeamSlot(user.id, slot, unitId);
  return user;
}

it('persiste 45 segundos de prazo e não permite estendê-lo consultando a batalha', async () => {
  const user = await player();
  const battle = await battles.startQuickBattle(user.id);
  expect(Date.parse(battle.turnDeadlineAt!) - now).toBe(TURN_DURATION_MS);
  now += 10_000;
  const restored = await new PostgresBattleRepository(pool, () => 0, () => now).getBattle(user.id, battle.id);
  expect(restored.turnDeadlineAt).toBe(battle.turnDeadlineAt);
  expect(restored.revision).toBe(0);
});

it('separa o turno do bot, espera 7 segundos e o resolve uma única vez mesmo com consultas concorrentes', async () => {
  const user = await player();
  const battle = await battles.startQuickBattle(user.id);
  const requestId = randomUUID();
  const response = await battles.submitTurn(user.id, battle.id, 0, requestId, []);
  expect(response.battle.state.activeSide).toBe('enemy');
  expect(Date.parse(response.battle.botActsAt!) - now).toBe(BOT_THINK_MS);
  expect(response.events.some((event) => event.kind === 'damage')).toBe(false);
  expect(response.battle.combo?.side).toBe('enemy');
  expect(response.battle.combo?.actions.length).toBeGreaterThan(0);
  const projected = previewActions(response.battle.state, response.battle.combo!.actions).state;
  expect(projected.teams.player.units.map((unit) => unit.hp)).toEqual([85, 85, 85]);
  const initialHp = response.battle.state.teams.player.units.map((unit) => unit.hp);
  now += BOT_THINK_MS - 1;
  const waiting = await battles.getBattle(user.id, battle.id);
  expect(waiting.combo).toEqual(response.battle.combo);
  expect(waiting.state.teams.player.units.map((unit) => unit.hp)).toEqual(initialHp);
  await expect(battles.submitTurn(user.id, battle.id, 1, randomUUID(), [])).rejects.toMatchObject({ statusCode: 409 });
  now++;
  const [first, second] = await Promise.all([battles.getBattle(user.id, battle.id), battles.getBattle(user.id, battle.id)]);
  expect(first).toEqual(second);
  expect(first.revision).toBe(2);
  expect(first.state.activeSide).toBe('player');
  expect(first.combo).toEqual({ side: 'player', actions: [] });
  expect(first.log?.some((event) => event.kind === 'damage')).toBe(true);
  expect(first.state.teams.player.units.map((unit) => unit.hp)).toEqual(projected.teams.player.units.map((unit) => unit.hp));
  expect(Date.parse(first.turnDeadlineAt!) - now).toBe(TURN_DURATION_MS);
  expect(await battles.submitTurn(user.id, battle.id, 0, requestId, [])).toEqual(response);
});

it('encerra um turno vencido no servidor e rejeita habilidades enviadas após o limite', async () => {
  const user = await player();
  const battle = await battles.startQuickBattle(user.id);
  now += TURN_DURATION_MS;
  await expect(battles.submitTurn(user.id, battle.id, 0, randomUUID(), [
    { actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' },
  ])).rejects.toMatchObject({ statusCode: 409 });
  const current = await battles.getBattle(user.id, battle.id);
  expect(current.revision).toBe(1);
  expect(current.state.activeSide).toBe('enemy');
  expect(current.state.teams.enemy.units.every((unit) => unit.hp === 100)).toBe(true);
  expect(current.log?.filter((event) => event.message.includes('encerrado automaticamente'))).toHaveLength(1);
  expect((await pool.query('SELECT count(*)::int AS count FROM battle_commands WHERE battle_id = $1', [battle.id])).rows[0].count).toBe(0);
});

it('o processamento periódico avança prazos e o bot sem qualquer comando do jogador', async () => {
  const user = await player();
  const battle = await battles.startQuickBattle(user.id);
  now += TURN_DURATION_MS;
  await battles.processDueBattles();
  const expired = await pool.query<{ revision: number; side: string }>("SELECT revision, state->>'activeSide' AS side FROM battles WHERE id = $1", [battle.id]);
  expect(expired.rows[0]).toEqual({ revision: 1, side: 'enemy' });
  now += BOT_THINK_MS;
  await battles.processDueBattles();
  const resolved = await battles.getBattle(user.id, battle.id);
  expect(resolved.revision).toBe(2);
  expect(resolved.state.activeSide).toBe('player');
});

it('Multiplayer usa o limite de 45 segundos para os dois lados e nunca dispara a IA', async () => {
  const user = await player();
  const battle = await battles.startQuickBattle(user.id);
  await pool.query("UPDATE battles SET mode = 'multiplayer' WHERE id = $1", [battle.id]);
  const enemyTurn = await battles.submitTurn(user.id, battle.id, 0, randomUUID(), []);
  expect(enemyTurn.battle.botActsAt).toBeNull();
  expect(enemyTurn.battle.combo).toEqual({ side: 'enemy', actions: [] });
  now += BOT_THINK_MS;
  const waiting = await battles.getBattle(user.id, battle.id);
  expect(waiting.revision).toBe(1);
  now = Date.parse(enemyTurn.battle.turnDeadlineAt!);
  const expired = await battles.getBattle(user.id, battle.id);
  expect(expired.state.activeSide).toBe('player');
  expect(expired.revision).toBe(2);
  expect(expired.log?.some((event) => event.kind === 'damage')).toBe(false);
});

it('cada turno extra do bot tem sua própria pausa, sem executar uma sequência instantânea', async () => {
  const user = await player();
  const battle = await battles.startQuickBattle(user.id);
  const waiting = (await battles.submitTurn(user.id, battle.id, 0, randomUUID(), [])).battle;
  waiting.state.teams.enemy.energy = 100;
  waiting.state.teams.enemy.units.forEach((unit, index) => { unit.abilityIds = [index === 0 ? 'extra-turn' : 'retain-energy']; });
  await pool.query('UPDATE battles SET state = $2, combo = NULL WHERE id = $1', [battle.id, JSON.stringify(waiting.state)]);
  now += BOT_THINK_MS;
  const extra = await battles.getBattle(user.id, battle.id);
  expect(extra.state.activeSide).toBe('enemy');
  expect(extra.state.turn).toBe(3);
  expect(Date.parse(extra.botActsAt!) - now).toBe(BOT_THINK_MS);
  now += BOT_THINK_MS - 1;
  expect((await battles.getBattle(user.id, battle.id)).revision).toBe(extra.revision);
});

it('desistência limpa os prazos e impede atualizações automáticas posteriores', async () => {
  const user = await player();
  const battle = await battles.startQuickBattle(user.id);
  await battles.submitTurn(user.id, battle.id, 0, randomUUID(), []);
  const abandoned = await battles.abandonBattle(user.id, battle.id);
  expect(abandoned.turnDeadlineAt).toBeNull();
  expect(abandoned.botActsAt).toBeNull();
  now += 60_000;
  await battles.processDueBattles();
  expect(await battles.getBattle(user.id, battle.id)).toEqual(abandoned);
});
