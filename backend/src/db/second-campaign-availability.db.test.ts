import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SECOND_CAMPAIGN_UNIT_IDS } from '@game/content/second-campaign.js';
import { encounters } from '@game/content/encounters.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { CmsRepository } from '../../../cms/server/repository.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const schema = `second_campaign_availability_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
const game = new PostgresGameRepository(pool);
const auth = new PostgresAuthRepository(pool);
const cms = new CmsRepository(pool);
beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await migrate(pool); await seedDatabase(pool); });
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
const player = () => auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) });

it('inicializa os 17 personagens habilitados e mantém a aquisição por missões ou Premium', async () => {
  const ids = new Set<string>(SECOND_CAMPAIGN_UNIT_IDS);
  expect((await game.getCatalog()).units.filter((u) => ids.has(u.id))).toHaveLength(17);
  const user = await player();
  const missions = (await game.getCharacterUnlocks(user.id)).characters.filter((u) => ids.has(u.id));
  expect(missions).toHaveLength(17);
  expect(missions.every((u) => !u.unlocked)).toBe(true);
  expect(missions.find((u) => u.id === 'maga-artemis')?.kind).toBe('premium');
});

it('reativa autoria desabilitada e restaura encontros vazios sem apagar formações CMS, progresso ou snapshots', async () => {
  const user = await player();
  await game.setTeamSlot(user.id, 0, 'protagonist-main-base');
  const battle = await new PostgresBattleRepository(pool).startQuickBattle(user.id);
  const progress = await auth.getProgress(user.id);
  const published = (await pool.query("SELECT released FROM campaigns WHERE id='path-2'")).rows[0].released;
  await pool.query("DELETE FROM encounter_enemies WHERE encounter_id LIKE 'path-2-encounter-%'");
  const authored = await cms.catalog();
  const first = authored.encounters.find((e) => e.id === 'path-2-encounter-1')!;
  await cms.save('encounters', { ...first, title: 'Confronto editado no CMS', enemyUnitIds: ['protagonist-main-base'] }, false);
  const general = authored.characters.find((u) => u.id === 'general-abel')!;
  await cms.save('characters', { ...general, name: 'Abel editado', maxHp: 180, enabled: false }, false);
  await pool.query('UPDATE units SET enabled=false WHERE id=ANY($1::text[])', [SECOND_CAMPAIGN_UNIT_IDS]);
  await pool.query("DELETE FROM schema_migrations WHERE name='050_enable_second_campaign_characters.sql'");
  await migrate(pool); await seedDatabase(pool);
  const current = await cms.catalog();
  expect(current.characters.filter((u) => (SECOND_CAMPAIGN_UNIT_IDS as readonly string[]).includes(u.id)).every((u) => u.enabled)).toBe(true);
  expect(current.characters.find((u) => u.id === general.id)).toMatchObject({ name: 'Abel editado', maxHp: 180, enabled: true });
  expect(current.encounters.find((e) => e.id === first.id)).toMatchObject({ title: 'Confronto editado no CMS', enemyUnitIds: ['protagonist-main-base'] });
  for (const e of encounters.filter((e) => e.campaignId === 'path-2' && e.id !== first.id)) {
    expect(current.encounters.find((entry) => entry.id === e.id)?.enemyUnitIds).toEqual(e.enemyUnitIds);
  }
  expect(await auth.getProgress(user.id)).toEqual(progress);
  expect((await pool.query('SELECT state FROM battles WHERE id=$1', [battle.id])).rows[0].state).toEqual(battle.state);
  expect((await pool.query("SELECT released FROM campaigns WHERE id='path-2'")).rows[0].released).toBe(published);
  await cms.save('characters', { ...current.characters.find((u) => u.id === general.id)!, enabled: false }, false);
  await migrate(pool); await seedDatabase(pool);
  expect((await game.getCatalog()).units.some((u) => u.id === general.id)).toBe(false);
});
