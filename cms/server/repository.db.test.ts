import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { CmsRepository } from './repository';
import { createCmsApp } from './app';
import { createApp } from '../../backend/src/app';
import { readMedia } from '../../backend/src/db/media';
import { migrate } from '../../backend/src/db/migrations';
import { seedDatabase } from '../../backend/src/db/seed';
import { PostgresAuthRepository } from '../../backend/src/db/auth-repository';
import { PostgresGameRepository } from '../../backend/src/db/game-repository';
import { PostgresBattleRepository } from '../../backend/src/db/battle-repository';
import { abilities } from '../../shared/src/content/abilities';
import type { Campaign, Character, Encounter } from '../contracts';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const pool = new pg.Pool({ connectionString: url });
const repo = new CmsRepository(pool);
const auth = new PostgresAuthRepository(pool);
const game = new PostgresGameRepository(pool);
const battles = new PostgresBattleRepository(pool);
const campaign: Campaign = { id: 'cms-test-campaign', title: 'Campanha do CMS', description: 'Conteúdo criado pelo CMS.', chapterNumber: 100, sortOrder: 100,
  background: '/media/campaigns/path-1.webp', mapBackground: '/media/campaigns/mapa-campanha-01.png', prerequisiteEncounterId: null, released: true };
const encounter = (id: string, position: number): Encounter => ({ id, campaignId: campaign.id, position, title: `Batalha ${position}`, story: 'Um confronto de teste.',
  enemyUnitIds: ['road-raider-1-base'], mapX: 40, mapY: 50 });
const character = (): Character => ({ id: 'cms-test-character', characterId: 'cms-test-narrative', name: 'Autoria dinâmica', version: 'Base', description: 'Personagem criado no CMS.',
  maxHp: 100, portrait: '/media/abilities/guard.jpg', illustration: '/media/abilities/guard.jpg', abilityIds: ['simple-strike', 'guard', 'retain-energy', 'heal'],
  unlock: { kind: 'battle-wins', description: 'Finalize a batalha de teste.' }, unlockRule: { unitId: 'cms-test-character', description: 'Finalize a batalha de teste.',
    availableAfterEncounterId: 'cms-test-battle-a', requirements: [{ kind: 'encounter', encounterId: 'cms-test-battle-a', target: 1, description: 'Finalize a batalha A.' }] },
  priceUsd: null, rosterOrder: null });
beforeAll(async () => { await migrate(pool); await seedDatabase(pool); });
afterEach(async () => {
  await pool.query('TRUNCATE users CASCADE');
  await pool.query("DELETE FROM unit_abilities WHERE unit_id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM encounter_enemies WHERE encounter_id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM units WHERE id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM encounters WHERE id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM campaigns WHERE id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM abilities WHERE id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM narrative_characters WHERE id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM cms_content_overrides WHERE id LIKE 'cms-test-%'");
  await pool.query("DELETE FROM cms_ability_setups WHERE id LIKE 'cms-test-%'");
});
afterAll(async () => { await pool.end(); });
async function player() {
  return auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) });
}

it('cria, edita e exclui conteúdo; preserva edições e exclusões ao executar o seed', async () => {
  const original = (await repo.catalog()).abilities.find((a) => a.id === 'simple-strike')!;
  try {
    await repo.save('abilities', { ...original, name: 'Nome aprovado no CMS', effects: [{ kind: 'damage', amount: 27 }] }, false);
    await seedDatabase(pool);
    expect((await game.getCatalog()).abilities.find((a) => a.id === original.id)).toMatchObject({ name: 'Nome aprovado no CMS', effects: [{ kind: 'damage', amount: 27 }] });
  } finally {
    await repo.save('abilities', original, false);
    await pool.query("DELETE FROM cms_content_overrides WHERE entity='abilities' AND id=$1", [original.id]);
  }
  await repo.save('abilities', { ...abilities.guard, id: 'cms-test-ability', name: 'Guarda nova' }, true);
  await expect(repo.save('abilities', { ...abilities.guard, id: 'cms-test-ability' }, true)).rejects.toMatchObject({ statusCode: 409 });
  await repo.saveSetup({ id: 'cms-test-setup', name: 'Guarda reutilizável', config: { energyCost: 10, target: 'self', effects: [{ kind: 'guard', reduction: 10, teamTurns: 2 }] } });
  expect((await repo.catalog()).setups.some((s) => s.id === 'cms-test-setup')).toBe(true);
  await repo.remove('abilities', 'cms-test-ability');
  expect((await repo.catalog()).abilities.some((a) => a.id === 'cms-test-ability')).toBe(false);
  expect((await pool.query("SELECT deleted FROM cms_content_overrides WHERE entity='abilities' AND id='cms-test-ability'")).rows[0].deleted).toBe(true);
});

it('reordena confrontos em transação e usa campanhas, habilidades e desbloqueios dinâmicos no jogo', async () => {
  await repo.save('campaigns', campaign, true);
  const a = encounter('cms-test-battle-a', 1); const b = encounter('cms-test-battle-b', 2);
  await repo.save('encounters', a, true); await repo.save('encounters', b, true);
  await repo.save('encounters', { ...b, position: 1 }, false);
  expect((await repo.catalog()).encounters.filter((e) => e.campaignId === campaign.id).map((e) => [e.id, e.position])).toEqual([[b.id, 1], [a.id, 2]]);
  await expect(repo.save('encounters', { ...a, enemyUnitIds: ['nonexistent'] }, false)).rejects.toMatchObject({ code: '23503' });
  expect((await repo.catalog()).encounters.filter((e) => e.campaignId === campaign.id).map((e) => e.id)).toEqual([b.id, a.id]);
  await repo.save('abilities', { ...abilities['simple-strike'], id: 'cms-test-ability', effects: [{ kind: 'damage', amount: 27 }] }, true);
  await repo.save('characters', { ...character(), abilityIds: ['cms-test-ability', 'guard', 'retain-energy', 'heal'] }, true);
  const user = await player();
  expect((await game.getCampaigns(user.id)).find((c) => c.id === campaign.id)).toMatchObject({ available: true, mapBackground: campaign.mapBackground });
  expect((await game.getCharacterUnlocks(user.id)).characters.find((c) => c.id === 'cms-test-character')).toMatchObject({ campaignAvailable: false, unlocked: false, revealRequirement: 'Finalize a batalha 2 da campanha 100' });
  await pool.query("UPDATE player_progress SET data=jsonb_set(data,'{completedEncounters}',$2::jsonb) WHERE user_id=$1", [user.id, JSON.stringify([a.id])]);
  expect((await auth.getProgress(user.id))?.unlockedUnitIds).toContain('cms-test-character');
  await game.setTeamSlot(user.id, 0, 'cms-test-character');
  const battle = await battles.startBattle(user.id, b.id);
  expect(battle.state.teams.player.units[0].unitId).toBe('cms-test-character');
  expect(battle.state.abilities['cms-test-ability'].effects).toEqual([{ kind: 'damage', amount: 27 }]);
  await expect(repo.remove('characters', 'cms-test-character')).rejects.toMatchObject({ statusCode: 409 });
  await expect(repo.remove('encounters', a.id)).rejects.toMatchObject({ statusCode: 409 });
});

it('remove confrontos sem uso e compacta posições; concede novos personagens iniciais no cadastro', async () => {
  await repo.save('campaigns', campaign, true);
  await repo.save('encounters', encounter('cms-test-battle-a', 1), true);
  await repo.save('encounters', encounter('cms-test-battle-b', 2), true);
  await repo.save('encounters', encounter('cms-test-battle-c', 3), true);
  await repo.remove('encounters', 'cms-test-battle-b');
  expect((await repo.catalog()).encounters.filter((e) => e.campaignId === campaign.id).map((e) => [e.id, e.position])).toEqual([['cms-test-battle-a', 1], ['cms-test-battle-c', 2]]);
  await repo.save('characters', { ...character(), unlock: { kind: 'starter', description: 'Inicial do CMS.' }, unlockRule: null }, true);
  const user = await player();
  const persisted = await pool.query('SELECT data FROM player_progress WHERE user_id=$1', [user.id]);
  expect(persisted.rows[0].data.unlockedUnitIds).toContain('cms-test-character');
});

it('aplica requisitos de acesso a campanhas tanto no mapa quanto na criação de batalha', async () => {
  await repo.save('campaigns', { ...campaign, prerequisiteEncounterId: 'path-1-encounter-1' }, true);
  const a = encounter('cms-test-battle-a', 1); await repo.save('encounters', a, true);
  const user = await player();
  await game.setTeamSlot(user.id, 0, 'protagonist-main-base');
  await expect(battles.getMap(user.id, campaign.id)).rejects.toMatchObject({ statusCode: 403 });
  await expect(battles.startBattle(user.id, a.id)).rejects.toMatchObject({ statusCode: 403 });
  await pool.query("UPDATE player_progress SET data=jsonb_set(data,'{completedEncounters}','[\"path-1-encounter-1\"]') WHERE user_id=$1", [user.id]);
  expect((await battles.getMap(user.id, campaign.id)).campaign.available).toBe(true);
  expect((await battles.startBattle(user.id, a.id)).encounterId).toBe(a.id);
});

it('publica e despublica a campanha 02 para uma conta nova usando somente a configuração do CMS', async () => {
  const original = (await repo.catalog()).campaigns.find((c) => c.id === 'path-2')!;
  const previousOverride = await pool.query("SELECT * FROM cms_content_overrides WHERE entity='campaigns' AND id='path-2'");
  const user = await player();
  await game.setTeamSlot(user.id, 0, 'protagonist-main-base');
  try {
    await repo.save('campaigns', { ...original, prerequisiteEncounterId: null, released: true, description: 'História publicada pelo CMS.' }, false);
    expect((await game.getCampaigns(user.id)).find((c) => c.id === original.id)).toMatchObject({ available: true, description: 'História publicada pelo CMS.' });
    expect((await battles.getMap(user.id, original.id)).campaign.description).toBe('História publicada pelo CMS.');
    expect((await battles.startBattle(user.id, 'path-2-encounter-1')).encounterId).toBe('path-2-encounter-1');
    await pool.query("UPDATE player_progress SET data=jsonb_set(data,'{completedEncounters}','[\"path-2-encounter-1\"]') WHERE user_id=$1", [user.id]);
    expect((await battles.getQuickBattle(user.id)).opponents.some((unit) => unit.id === 'general-abel')).toBe(true);
    expect((await game.getCharacterUnlocks(user.id)).characters.find((unit) => unit.id === 'general-abel')).toMatchObject({ campaignAvailable: true, unlocked: false, revealRequirement: 'Finalize a batalha 1 da campanha 2' });
    await seedDatabase(pool);
    expect((await game.getCampaigns(user.id)).find((c) => c.id === original.id)?.available).toBe(true);
    await repo.save('campaigns', { ...original, released: false }, false);
    await expect(battles.getMap(user.id, original.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(battles.startBattle(user.id, 'path-2-encounter-1')).rejects.toMatchObject({ statusCode: 403 });
  } finally {
    await repo.save('campaigns', original, false);
    if (!previousOverride.rowCount) await pool.query("DELETE FROM cms_content_overrides WHERE entity='campaigns' AND id='path-2'");
  }
});

it('reordena o catálogo inteiro atomicamente, preserva a ordem no seed e rejeita listas incompletas', async () => {
  const original = (await repo.catalog()).characters.map((c) => c.id);
  const overrides = await pool.query<{ id: string }>("SELECT id FROM cms_content_overrides WHERE entity='characters'");
  const ids = [...original]; [ids[0], ids[1]] = [ids[1], ids[0]];
  try {
    await repo.reorderCharacters(ids);
    expect((await game.getCatalog()).units.map((u) => u.id)).toEqual(ids);
    await seedDatabase(pool);
    expect((await repo.catalog()).characters.map((u) => u.id)).toEqual(ids);
    await expect(repo.reorderCharacters(ids.slice(1))).rejects.toMatchObject({ statusCode: 409 });
    expect((await game.getCatalog()).units.map((u) => u.id)).toEqual(ids);
  } finally {
    await repo.reorderCharacters(original);
    await pool.query("DELETE FROM cms_content_overrides WHERE entity='characters' AND NOT (id=ANY($1::text[]))", [overrides.rows.map((r) => r.id)]);
  }
});

it('impede recompensas diretas no banco e não concede adversários ao concluir um confronto', async () => {
  await expect(pool.query("INSERT INTO encounter_rewards (encounter_id,unit_id) VALUES ('path-1-encounter-1','road-raider-1-base')")).rejects.toMatchObject({ code: '23514' });
  const user = await player();
  await game.setTeamSlot(user.id, 0, 'protagonist-main-base');
  const battle = await battles.startBattle(user.id, 'path-1-encounter-1');
  const state = structuredClone(battle.state);
  state.teams.enemy.units.forEach((unit, index) => { unit.hp = index ? 0 : 1; });
  state.teams.player.energy = 100;
  await pool.query('UPDATE battles SET state=$2 WHERE id=$1', [battle.id, JSON.stringify(state)]);
  const result = await battles.submitTurn(user.id, battle.id, battle.revision, randomUUID(), [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]);
  expect(result.battle.state.status).toBe('victory');
  const progress = (await auth.getProgress(user.id))!;
  expect(progress.completedEncounters).toContain('path-1-encounter-1');
  expect(progress.unlockedUnitIds).not.toContain('road-raider-1-base');
  expect((await battles.getMap(user.id, 'path-1')).encounters[0]).not.toHaveProperty('rewardUnitIds');
});

it('uma missão revelada após batalha específica não conta vitórias anteriores à revelação', async () => {
  await repo.save('campaigns', campaign, true);
  const c = character();
  await repo.save('encounters', encounter('cms-test-battle-a', 1), true);
  await repo.save('characters', { ...c, unlockRule: { unitId: c.id, description: 'Uma rápida após revelar.', availableAfterEncounterId: 'cms-test-battle-a', requirements: [{ kind: 'battle-wins', mode: 'quick', target: 1, description: 'Vença uma rápida.' }] } }, true);
  const e = { ...encounter('cms-test-battle-a', 1), enemyUnitIds: [c.id] };
  await repo.save('encounters', e, false);
  const user = await player();
  const state = { teams: { player: { units: [{ unitId: 'protagonist-main-base' }] }, enemy: { units: [{ unitId: 'road-raider-1-base' }] } } };
  await pool.query(`INSERT INTO battles (id,user_id,encounter_id,state,status,mode,updated_at) VALUES
    ($1,$2,NULL,$3,'victory','quick','2026-11-01T10:00:00Z'), ($4,$2,$5,$3,'victory','campaign','2026-11-01T12:00:00Z')`,
  [randomUUID(), user.id, JSON.stringify(state), randomUUID(), e.id]);
  await pool.query("UPDATE player_progress SET data=jsonb_set(data,'{completedEncounters}',$2::jsonb) WHERE user_id=$1", [user.id, JSON.stringify([e.id])]);
  const mission = (await game.getCharacterUnlocks(user.id)).characters.find((unit) => unit.id === c.id)!;
  expect(mission.campaignAvailable).toBe(true);
  expect(mission.kind === 'battle-wins' && mission.requirements[0].current).toBe(0);
  await pool.query(`INSERT INTO battles (id,user_id,encounter_id,state,status,mode,updated_at) VALUES ($1,$2,NULL,$3,'victory','quick','2026-11-01T13:00:00Z')`, [randomUUID(), user.id, JSON.stringify(state)]);
  expect((await auth.getProgress(user.id))?.unlockedUnitIds).toContain(c.id);
});

it('recebe imagens raster no banco e rejeita SVG/HTML e mutações sem validação', async () => {
  const app = createCmsApp(pool);
  let mediaId: string | undefined;
  try {
    const token = (await app.inject({ url: '/api/status', headers: { host: '127.0.0.1:5188' } })).json().token;
    const headers = { host: '127.0.0.1:5188', origin: 'http://127.0.0.1:5188', 'x-cms-token': token };
    const invalid = await app.inject({ method: 'POST', url: '/api/media', headers, payload: { base64: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64') } });
    expect(invalid.statusCode).toBe(400);
    const content = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64');
    const uploaded = await app.inject({ method: 'POST', url: '/api/media', headers, payload: { base64: content.toString('base64') } });
    expect(uploaded.statusCode).toBe(201);
    const path = uploaded.json().path; mediaId = path.split('/').pop();
    const image = await app.inject({ url: path, headers: { host: '127.0.0.1:5188' } });
    expect(image.headers['content-type']).toBe('image/png'); expect(image.rawPayload.equals(content)).toBe(true);
    const gameApp = await createApp({ repository: auth, gameRepository: game, origin: 'http://127.0.0.1:5173', readMedia: (id) => readMedia(pool, id) });
    try {
      const publicImage = await gameApp.inject({ url: path });
      expect(publicImage.statusCode).toBe(200);
      expect(publicImage.rawPayload.equals(content)).toBe(true);
      expect(publicImage.headers['cache-control']).toContain('immutable');
      expect(publicImage.headers['x-content-type-options']).toBe('nosniff');
      expect((await gameApp.inject({ url: '/media/cms/not-a-uuid' })).statusCode).toBe(404);
    } finally { await gameApp.close(); }
    const badAbility = await app.inject({ method: 'POST', url: '/api/abilities', headers, payload: { ...abilities.guard, target: 'enemy' } });
    expect(badAbility.statusCode).toBe(400);
  } finally { await app.close(); if (mediaId) await pool.query('DELETE FROM cms_media WHERE id=$1', [mediaId]); }
});
