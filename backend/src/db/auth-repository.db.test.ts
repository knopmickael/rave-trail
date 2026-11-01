import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createInitialProgress } from '@game/contracts.js';
import { createApp } from '../app.js';
import { hashSessionToken } from '../auth/crypto.js';
import { EmailAlreadyUsedError } from '../auth/repository.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresGameRepository } from './game-repository.js';
import { GameError } from '../game/repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import type { BattleRecord } from '@game/core/battle.js';
import { abilities } from '@game/content/abilities.js';
import { STARTER_UNIT_IDS, units } from '@game/content/units.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL deve apontar para um banco exclusivo cujo nome termine em _test, diferente de DATABASE_URL.');
}
const pool = new pg.Pool({ connectionString: url });
const repository = new PostgresAuthRepository(pool);
const gameRepository = new PostgresGameRepository(pool);
const battleRepository = new PostgresBattleRepository(pool);
const session = () => ({ tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 60000) });

beforeAll(async () => { await migrate(pool); await seedDatabase(pool); await migrate(pool); await seedDatabase(pool); });
beforeEach(async () => { await pool.query('TRUNCATE users CASCADE'); });
afterAll(async () => { await pool.end(); });

it('persiste conta, sessão e progresso e permite leitura em outra instância', async () => {
  const input = session();
  const user = await repository.register('persistente@example.com', 'hash-de-teste', input);
  const another = new PostgresAuthRepository(pool);
  expect(await another.findSession(input.tokenHash)).toEqual({ ...user, sessionExpiresAt: input.expiresAt.toISOString() });
  expect(await another.getProgress(user.id)).toEqual(createInitialProgress());
  expect((await another.findCredentials(user.email))?.passwordHash).toBe('hash-de-teste');
  await pool.query('UPDATE sessions SET expires_at = now() - interval \'1 second\' WHERE token_hash = $1', [input.tokenHash]);
  expect(await another.findSession(input.tokenHash)).toBeNull();
});

it('garante unicidade em cadastros concorrentes sem deixar registros órfãos', async () => {
  const results = await Promise.allSettled([
    repository.register('duplicado@example.com', 'hash', session()),
    repository.register('duplicado@example.com', 'hash', session()),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
  expect(rejected.reason).toBeInstanceOf(EmailAlreadyUsedError);
  for (const table of ['users', 'sessions', 'player_progress']) {
    expect((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count).toBe(1);
  }
});

it('persiste o nome por conta e o recupera por credenciais e sessões de outras instâncias', async () => {
  const input = session();
  const user = await repository.register('nome-persistente@example.com', 'hash', input);
  const other = await repository.register('nome-outra@example.com', 'hash', session());
  expect(user.name).toBe('Aventureiro');
  await repository.updateName(user.id, 'Guardião de Berdal');
  const restored = new PostgresAuthRepository(pool);
  expect((await restored.findCredentials(user.email))?.name).toBe('Guardião de Berdal');
  expect(await restored.findSession(input.tokenHash)).toMatchObject({ name: 'Guardião de Berdal', sessionExpiresAt: input.expiresAt.toISOString() });
  expect((await restored.findCredentials(other.email))?.name).toBe('Aventureiro');
});

it('reverte toda a criação se a sessão não puder ser gravada', async () => {
  const input = session();
  await repository.register('primeiro@example.com', 'hash', input);
  await expect(repository.register('segundo@example.com', 'hash', input)).rejects.toThrow();
  expect(await repository.findCredentials('segundo@example.com')).toBeNull();
  expect((await pool.query('SELECT count(*)::int AS count FROM player_progress')).rows[0].count).toBe(1);
});

it('executa cadastro, login, consulta e logout HTTP com PostgreSQL real', async () => {
  const origin = 'http://127.0.0.1:5173';
  const app = await createApp({ repository, gameRepository, battleRepository, origin });
  try {
    const payload = { email: 'http@example.com', password: 'senha de integração' };
    expect((await app.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload })).statusCode).toBe(201);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload });
    expect(login.statusCode).toBe(200);
    const cookie = `rave_trail_session=${login.cookies[0].value}`;
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).json().user.email).toBe(payload.email);
    expect((await app.inject({ url: '/api/progress', headers: { cookie } })).json().progress).toEqual(createInitialProgress());
    expect((await app.inject({ url: '/api/catalog', headers: { cookie } })).json().catalog.units.find((unit: { id: string }) => unit.id === 'protagonist-main-base').name).toBe('Ravi de Berdal');
    const assigned = await app.inject({ method: 'PUT', url: '/api/team/slots/1', headers: { origin, cookie }, payload: { unitId: 'protagonist-main-base' } });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json().team).toEqual([null, 'protagonist-main-base', null]);
    expect((await app.inject({ url: '/api/progress', headers: { cookie } })).json().progress.selectedTeam).toEqual(assigned.json().team);
    expect((await app.inject({ method: 'PUT', url: '/api/team/slots/0', headers: { origin, cookie }, payload: { unitId: 'passage-guardian-base' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin, cookie } })).statusCode).toBe(204);
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);
  } finally { await app.close(); }
});

it('lê catálogo persistido, com os nomes aprovados e quatro habilidades por unidade', async () => {
  const catalog = await gameRepository.getCatalog();
  expect(catalog.units.slice(0, 6).map((unit) => unit.name)).toEqual([
    'Ravi de Berdal', 'Doko de Berdal', 'Anna de Berdal', 'Saqueador da estrada I', 'Saqueador da estrada II', 'Saqueadora da estrada',
  ]);
  expect(catalog.abilities).toHaveLength(20);
  for (const unit of catalog.units) expect(unit.abilityIds).toHaveLength(4);
  await pool.query("UPDATE units SET description = 'Descrição do banco' WHERE id = 'protagonist-main-base'");
  expect((await gameRepository.getCatalog()).units.find((unit) => unit.id === 'protagonist-main-base')?.description).toBe('Descrição do banco');
  await seedDatabase(pool);
});

it('migra custos, alvos e conjuntos antigos sem alterar a equipe ou o progresso', async () => {
  const user = await repository.register('habilidades-migradas@example.com', 'hash', session());
  await gameRepository.setTeamSlot(user.id, 1, 'protagonist-main-base');
  const progressBefore = await repository.getProgress(user.id);
  const changedIds = ['road-raider-2-base', 'rival-a-base', 'rival-b-base', 'passage-guardian-base',
    'guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c', 'protagonist-main-transformed', 'rival-b-final-mode', 'legendary-beast-premium'];
  await pool.query("UPDATE abilities SET target = 'ally' WHERE id = 'guard'");
  await pool.query("UPDATE abilities SET energy_cost = 30 WHERE id = 'heal'");
  await pool.query('DELETE FROM unit_abilities');
  for (const id of changedIds) {
    const previous = id === 'passage-guardian-base' ? ['strong-strike', 'guard', 'retain-energy', 'extra-turn']
      : ['simple-strike', 'guard', 'retain-energy', id === 'protagonist-main-transformed' ? 'main-special' : 'strong-strike'];
    for (const [slot, abilityId] of previous.entries()) {
      await pool.query('INSERT INTO unit_abilities (unit_id, slot_index, ability_id) VALUES ($1,$2,$3)', [id, slot, abilityId]);
    }
  }
  await pool.query("DELETE FROM abilities WHERE id IN ('retain-energy-plus', 'soul-drain', 'soul-drain-plus', 'fury-scream', 'heal-plus', 'resurrection', 'simple-strike-ii', 'quick-slash', 'dark-vortex', 'fast-move', 'internal-strength')");
  await pool.query('ALTER TABLE abilities DROP CONSTRAINT abilities_target_check');
  await pool.query("ALTER TABLE abilities ADD CONSTRAINT abilities_target_check CHECK (target IN ('enemy', 'ally', 'all-enemies', 'all-allies', 'team'))");
  await pool.query("DELETE FROM schema_migrations WHERE name IN ('006_abilities_and_loadouts.sql', '007_passago_abilities.sql', '008_trinity_retain_energy.sql', '009_berserk_and_final_exal_guard.sql', '012_drak_collective_guard.sql', '013_quick_starters_and_berserk.sql', '022_abilities_balance_and_new_skills.sql', '023_collective_guard_reduction.sql', '024_healing_and_drain_energy_costs.sql', '028_internal_strength.sql')");
  await migrate(pool);
  await seedDatabase(pool);
  await migrate(pool);
  await seedDatabase(pool);
  const catalog = await gameRepository.getCatalog();
  for (const ability of Object.values(abilities)) {
    expect(catalog.abilities.find((entry) => entry.id === ability.id)).toEqual(ability);
  }
  for (const unit of units) {
    expect(catalog.units.find((entry) => entry.id === unit.id)?.abilityIds).toEqual(unit.abilityIds);
  }
  expect(await repository.getProgress(user.id)).toEqual(progressBefore);
});

it('persiste Força interna e a ativação no próximo turno no snapshot oficial da batalha', async () => {
  const user = await repository.register('forca-interna@example.com', 'hash', session());
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', (data->'unlockedUnitIds') || '[\"road-raider-1-base\"]'::jsonb) WHERE user_id = $1", [user.id]);
  await gameRepository.setTeamSlot(user.id, 0, 'road-raider-1-base');
  await gameRepository.setTeamSlot(user.id, 1, STARTER_UNIT_IDS[1]);
  const battle = await battleRepository.startBattle(user.id, 'path-1-encounter-1');
  battle.state.teams.player.energy = 35;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [battle.id, JSON.stringify(battle.state)]);
  const result = await battleRepository.submitTurn(user.id, battle.id, 0, randomUUID(),
    [{ actorId: 'player-0', abilityId: 'internal-strength', targetId: 'player-1' }]);
  const restored = await battleRepository.getBattle(user.id, battle.id);
  expect(restored.state.teams.player.units[1]).toMatchObject({ damageBoostAmount: 15, damageBoostStartsAt: 2, damageBoostExpiresAt: 3 });
  expect(restored.state.teams.player.units[0].abilityIds).toEqual(['simple-strike', 'guard', 'retain-energy', 'internal-strength']);
  expect(restored.state.teams.player.energy).toBe(0);
  expect(restored).toEqual(result.battle);
});

it('persiste os quatro inimigos posteriores a Drak sem duplicar registros ao reaplicar o seed', async () => {
  const ids = ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c', 'rival-b-final-mode'];
  await seedDatabase(pool);
  const catalog = await gameRepository.getCatalog();
  const enemies = catalog.units.filter((unit) => ids.includes(unit.id));
  expect(enemies).toHaveLength(4);
  for (const enemy of enemies) {
    expect(enemy.provisional).toBe(true);
    expect(enemy.rosterOrder).toBeGreaterThanOrEqual(0);
    expect(enemy.abilityIds).toHaveLength(4);
    const definition = units.find((unit) => unit.id === enemy.id)!;
    expect(enemy.portrait).toBe(definition.portrait);
    expect(enemy.illustration).toBe(definition.illustration);
  }
  expect(catalog.units.find((unit) => unit.id === 'rival-b-base')?.characterId).toBe('rival-b');
  expect(catalog.units.find((unit) => unit.id === 'rival-b-final-mode')?.characterId).toBe('rival-b');
  expect(catalog.units).toHaveLength(36);
  expect(catalog.units.find((unit) => unit.id === 'rival-b-final-mode')?.unlock.kind).toBe('premium');
  expect(catalog.units.find((unit) => unit.id === 'legendary-beast-premium')?.unlock.kind).toBe('premium');
});

it('persiste os slots, preserva posições vazias, move sem duplicar e isola contas', async () => {
  const first = await repository.register('equipe@example.com', 'hash', session());
  const second = await repository.register('outra@example.com', 'hash', session());
  expect((await repository.getProgress(first.id))!.selectedTeam).toEqual([null, null, null]);
  await gameRepository.setTeamSlot(first.id, 1, 'protagonist-main-base');
  expect((await new PostgresAuthRepository(pool).getProgress(first.id))!.selectedTeam).toEqual([null, 'protagonist-main-base', null]);
  await gameRepository.setTeamSlot(first.id, 2, 'protagonist-main-base');
  expect((await repository.getProgress(first.id))!.selectedTeam).toEqual([null, null, 'protagonist-main-base']);
  await gameRepository.setTeamSlot(first.id, 2, 'protagonist-female-base');
  expect((await repository.getProgress(first.id))!.selectedTeam).toEqual([null, null, 'protagonist-female-base']);
  await gameRepository.setTeamSlot(first.id, 2, null);
  expect((await repository.getProgress(first.id))!.selectedTeam).toEqual([null, null, null]);
  expect((await repository.getProgress(second.id))!.selectedTeam).toEqual([null, null, null]);
  expect((await pool.query("SELECT data ? 'selectedTeam' AS duplicated FROM player_progress WHERE user_id = $1", [first.id])).rows[0].duplicated).toBe(false);
});

it('rejeita bloqueados e serializa alterações concorrentes sem duplicar uma unidade', async () => {
  const user = await repository.register('concorrente@example.com', 'hash', session());
  await expect(gameRepository.setTeamSlot(user.id, 0, 'passage-guardian-base')).rejects.toBeInstanceOf(GameError);
  await expect(gameRepository.setTeamSlot(user.id, 3, 'protagonist-main-base')).rejects.toBeInstanceOf(GameError);
  await Promise.all([gameRepository.setTeamSlot(user.id, 0, 'protagonist-main-base'), gameRepository.setTeamSlot(user.id, 2, 'protagonist-main-base')]);
  expect((await repository.getProgress(user.id))!.selectedTeam.filter(Boolean)).toEqual(['protagonist-main-base']);
});

it('migra a antiga equipe automática para vazia e preserva configurações personalizadas', async () => {
  const first = await repository.register('legado@example.com', 'hash', session());
  const second = await repository.register('personalizado@example.com', 'hash', session());
  await pool.query("UPDATE player_progress SET data = data || $2::jsonb WHERE user_id = $1", [first.id, JSON.stringify({ selectedTeam: ['protagonist-main-base', 'protagonist-secondary-base', 'protagonist-female-base'] })]);
  await pool.query("UPDATE player_progress SET data = data || $2::jsonb WHERE user_id = $1", [second.id, JSON.stringify({ selectedTeam: [null, 'protagonist-female-base', null] })]);
  await seedDatabase(pool);
  expect((await repository.getProgress(first.id))!.selectedTeam).toEqual([null, null, null]);
  expect((await repository.getProgress(second.id))!.selectedTeam).toEqual([null, 'protagonist-female-base', null]);
  await seedDatabase(pool);
  expect((await repository.getProgress(second.id))!.selectedTeam).toEqual([null, 'protagonist-female-base', null]);
});

it('persiste duas campanhas e deriva disponibilidade por conta sem alterar progresso no seed', async () => {
  const user = await repository.register('campanha@example.com', 'hash', session());
  const initial = await gameRepository.getCampaigns(user.id);
  expect(initial.map((campaign) => [campaign.id, campaign.chapterNumber, campaign.available])).toEqual([['path-1', 1, true], ['path-2', 2, false]]);
  await pool.query("UPDATE player_progress SET data = jsonb_set(data, '{availablePathIds}', '[\"path-2\"]'::jsonb) WHERE user_id = $1", [user.id]);
  await seedDatabase(pool);
  expect((await gameRepository.getCampaigns(user.id)).map((campaign) => campaign.available)).toEqual([false, true]);
  expect((await pool.query('SELECT count(*)::int AS count FROM campaigns')).rows[0].count).toBe(2);
});

it('retorna capítulos novos do banco sem alterar código da consulta', async () => {
  const user = await repository.register('mais-capitulos@example.com', 'hash', session());
  try {
    await pool.query(`INSERT INTO campaigns (id, chapter_number, title, description, background_path, sort_order, released)
      VALUES ('path-test-extra', 99, 'Capítulo adicional', 'Teste de expansão', '/media/campaigns/path-2.webp', 99, false)`);
    const result = await gameRepository.getCampaigns(user.id);
    expect(result).toHaveLength(3);
    expect(result[2].id).toBe('path-test-extra');
    expect(result[2].available).toBe(false);
  } finally { await pool.query("DELETE FROM campaigns WHERE id = 'path-test-extra'"); }
});

it('reaplica nomes e ordem sobre posições antigas sem conflito e preserva equipe, desbloqueios e habilidades', async () => {
  const user = await repository.register('reordenacao@example.com', 'hash', session());
  await gameRepository.setTeamSlot(user.id, 1, 'protagonist-main-base');
  const progressBefore = await repository.getProgress(user.id);
  const abilitiesBefore = (await gameRepository.getCatalog()).units.map((unit) => [unit.id, unit.abilityIds]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  await pool.query('UPDATE units SET roster_order = roster_order + 100 WHERE roster_order IS NOT NULL');
  await pool.query('UPDATE units SET roster_order = $1 - roster_order WHERE roster_order BETWEEN 100 AND $1', [100 + units.length - 1]);
  await pool.query("UPDATE units SET name = 'Rival disciplinado' WHERE id = 'rival-b-base'");
  await seedDatabase(pool);
  await seedDatabase(pool);
  const catalog = await gameRepository.getCatalog();
  expect(catalog.units.map((unit) => unit.name)).toEqual([
    'Ravi de Berdal', 'Doko de Berdal', 'Anna de Berdal',
    'Saqueador da estrada I', 'Saqueador da estrada II', 'Saqueadora da estrada',
    'Jung de Grimória', 'Exal de Grimória', 'Monnica de Grimória',
    'Curandeiro de Pontes', 'Curandeira de Pontes', 'Drak de Pontes',
    'Trinity de Espinea', 'Vlade de Espinea', 'Passago de Espinea',
    'Jung de Grimória II', 'Ravi Berserk', 'Exal - Verdadeiro poder', 'Fera Lendária',
    ...units.filter((unit) => unit.version === 'Além das Fronteiras').map((unit) => unit.name),
  ]);
  expect(catalog.units.map((unit) => unit.rosterOrder)).toEqual(Array.from({ length: units.length }, (_, index) => index));
  expect(catalog.units.map((unit) => [unit.id, unit.abilityIds]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual(abilitiesBefore);
  expect(await repository.getProgress(user.id)).toEqual(progressBefore);
  expect(catalog.units.filter((unit) => unit.unlock.kind === 'premium').map((unit) => unit.id)).toEqual(['rival-b-final-mode', 'legendary-beast-premium', 'maga-artemis']);
});

async function nearVictory(battle: BattleRecord) {
  // Fixture confiável do banco: o cliente HTTP nunca pode enviar HP/resultado.
  const snapshot = JSON.parse(JSON.stringify(battle.state)) as BattleRecord['state'];
  snapshot.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
  snapshot.teams.player.energy = 100;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [battle.id, JSON.stringify(snapshot)]);
}

it('mapa inicial tem sete pontos, só o primeiro disponível, e rejeita pular encontros/equipe vazia', async () => {
  const user = await repository.register('mapa@example.com', 'hash', session());
  const map = await battleRepository.getMap(user.id, 'path-1');
  expect(map.encounters).toHaveLength(7);
  expect(map.encounters.map((entry) => entry.available)).toEqual([true, false, false, false, false, false, false]);
  expect(map.encounters[1].enemyUnitIds).toEqual(['rival-a-base', 'rival-b-base', 'rival-female-base']);
  expect(map.encounters[2].enemyUnitIds[0]).toBe('passage-guardian-base');
  await expect(battleRepository.getMap(user.id, 'path-2')).rejects.toMatchObject({ statusCode: 403 });
  await expect(battleRepository.startBattle(user.id, 'path-1-encounter-4')).rejects.toMatchObject({ statusCode: 403 });
  await expect(battleRepository.startBattle(user.id, 'path-1-encounter-1')).rejects.toMatchObject({ statusCode: 400 });
});

it('início concorrente cria partidas novas e encerra a anterior sem oferecer retomada', async () => {
  const user = await repository.register('inicio-batalha@example.com', 'hash', session());
  await gameRepository.setTeamSlot(user.id, 1, 'protagonist-main-base');
  const [first, repeated] = await Promise.all([battleRepository.startBattle(user.id, 'path-1-encounter-1'), battleRepository.startBattle(user.id, 'path-1-encounter-1')]);
  expect(first.id).not.toBe(repeated.id);
  expect(first.state.teams.player.energy).toBe(15);
  expect(first.state.teams.enemy.units).toHaveLength(3);
  await gameRepository.setTeamSlot(user.id, 1, 'protagonist-female-base');
  expect((await battleRepository.getBattle(user.id, first.id)).state.teams.player.units[0].unitId).toBe('protagonist-main-base');
  const saved = await Promise.all([battleRepository.getBattle(user.id, first.id), battleRepository.getBattle(user.id, repeated.id)]);
  expect(saved.map((battle) => battle.state.status).sort()).toEqual(['abandoned', 'active']);
  expect((await battleRepository.getMap(user.id, 'path-1')).encounters[0].activeBattleId).toBeNull();
});

it('vitórias da campanha liberam somente o próximo ponto sem conceder personagens das metas ou Premium', async () => {
  const user = await repository.register('jornada@example.com', 'hash', session());
  await gameRepository.setTeamSlot(user.id, 0, 'protagonist-main-base');
  for (let position = 1; position <= 7; position++) {
    const encounterId = `path-1-encounter-${position}`;
    const battle = await battleRepository.startBattle(user.id, encounterId);
    await nearVictory(battle);
    const requestId = randomUUID();
    const actions = [{ actorId: 'player-0', abilityId: position === 7 ? 'simple-strike-ii' : 'simple-strike', targetId: 'enemy-0' }];
    const response = await battleRepository.submitTurn(user.id, battle.id, 0, requestId, actions);
    expect(response.battle.state.status).toBe('victory');
    const duplicate = await battleRepository.submitTurn(user.id, battle.id, 0, requestId, actions);
    expect(duplicate).toEqual(response);
    const progress = (await repository.getProgress(user.id))!;
    expect(progress.completedEncounters).toHaveLength(position);
    expect(progress.unlockedUnitIds.includes('passage-guardian-base')).toBe(false);
    expect(progress.unlockedUnitIds.includes('protagonist-main-transformed')).toBe(false);
    expect(progress.unlockedUnitIds.includes('rival-b-final-mode')).toBe(false);
    expect(progress.unlockedUnitIds.includes('legendary-beast-premium')).toBe(false);
    const map = await battleRepository.getMap(user.id, 'path-1');
    expect(map.encounters.map((entry) => entry.available)).toEqual(map.encounters.map((_, index) => index <= position));
  }
});

it('isola batalhas, valida revisão e reenvio e não avança a campanha por ações comuns', async () => {
  const user = await repository.register('turno@example.com', 'hash', session());
  const other = await repository.register('batalha-alheia@example.com', 'hash', session());
  await gameRepository.setTeamSlot(user.id, 0, 'protagonist-main-base');
  const battle = await battleRepository.startBattle(user.id, 'path-1-encounter-1');
  await expect(battleRepository.getBattle(other.id, battle.id)).rejects.toMatchObject({ statusCode: 404 });
  await expect(battleRepository.submitTurn(other.id, battle.id, 0, randomUUID(), [])).rejects.toMatchObject({ statusCode: 404 });
  const id = randomUUID();
  const result = await battleRepository.submitTurn(user.id, battle.id, 0, id, [{ actorId: 'player-0', abilityId: 'retain-energy' }]);
  expect(result.battle.revision).toBe(1);
  expect(await battleRepository.submitTurn(user.id, battle.id, 0, id, [{ actorId: 'player-0', abilityId: 'retain-energy' }])).toEqual(result);
  await expect(battleRepository.submitTurn(user.id, battle.id, 0, randomUUID(), [])).rejects.toMatchObject({ statusCode: 409 });
  await expect(battleRepository.submitTurn(user.id, battle.id, 1, randomUUID(), [{ actorId: 'enemy-0', abilityId: 'retain-energy' }])).rejects.toThrow();
  expect((await repository.getProgress(user.id))!.completedEncounters).toEqual([]);
});

it('derrota não libera pontos e uma nova tentativa reinicia HP/energia', async () => {
  let now = Date.now();
  const timed = new PostgresBattleRepository(pool, () => 0, () => now);
  const user = await repository.register('derrota@example.com', 'hash', session());
  await gameRepository.setTeamSlot(user.id, 0, 'protagonist-main-base');
  const battle = await timed.startBattle(user.id, 'path-1-encounter-1');
  battle.state.teams.player.units[0].hp = 1;
  await pool.query('UPDATE battles SET state = $2 WHERE id = $1', [battle.id, JSON.stringify(battle.state)]);
  const response = await timed.submitTurn(user.id, battle.id, 0, randomUUID(), []);
  expect(response.battle.state.activeSide).toBe('enemy');
  now += 7000;
  expect((await timed.getBattle(user.id, battle.id)).state.status).toBe('defeat');
  expect((await battleRepository.getMap(user.id, 'path-1')).encounters[1].available).toBe(false);
  expect((await repository.getProgress(user.id))!.completedEncounters).toEqual([]);
  const retry = await battleRepository.startBattle(user.id, 'path-1-encounter-1');
  expect(retry.id).not.toBe(battle.id);
  expect(retry.state.teams.player.units[0].hp).toBe(100);
  expect(retry.state.teams.player.energy).toBe(15);
});

it('rotas HTTP protegem mapa/início/turnos e rejeitam resultado/estado enviado pelo cliente', async () => {
  const origin = 'http://127.0.0.1:5173';
  const app = await createApp({ repository, gameRepository, battleRepository, origin });
  try {
    expect((await app.inject({ url: '/api/campaigns/path-1/map' })).statusCode).toBe(401);
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload: { email: 'mapa-http@example.com', password: 'senha longa para teste' } });
    const cookie = `rave_trail_session=${registration.cookies[0].value}`;
    const headers = { origin, cookie };
    expect((await app.inject({ url: '/api/campaigns/path-1/map', headers })).json().map.encounters).toHaveLength(7);
    expect((await app.inject({ method: 'POST', url: '/api/encounters/path-1-encounter-4/battles', headers, payload: {} })).statusCode).toBe(403);
    await gameRepository.setTeamSlot(registration.json().user.id, 0, 'protagonist-main-base');
    const start = await app.inject({ method: 'POST', url: '/api/encounters/path-1-encounter-1/battles', headers, payload: {} });
    expect(start.statusCode).toBe(201);
    const battle = start.json().battle;
    const forged = await app.inject({ method: 'POST', url: `/api/battles/${battle.id}/turns`, headers,
      payload: { revision: 0, requestId: randomUUID(), actions: [], result: 'victory' } });
    expect(forged.statusCode).toBe(400);
    expect((await app.inject({ url: `/api/battles/${battle.id}`, headers })).json().battle.revision).toBe(0);
    const valid = await app.inject({ method: 'POST', url: `/api/battles/${battle.id}/turns`, headers,
      payload: { revision: 0, requestId: randomUUID(), actions: [{ actorId: 'player-0', abilityId: 'retain-energy' }] } });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().battle.revision).toBe(1);
  } finally { await app.close(); }
});
