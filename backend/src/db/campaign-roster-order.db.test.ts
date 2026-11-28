import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { migrate } from './test-migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresGameRepository } from './game-repository.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresBattleRepository } from './battle-repository.js';
import { CmsRepository } from '../../../cms/server/repository.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const schema = `campaign_roster_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
const game = new PostgresGameRepository(pool);
const cms = new CmsRepository(pool);
const auth = new PostgresAuthRepository(pool);
const ordered = [
  'protagonist-main-base', 'protagonist-secondary-base', 'protagonist-female-base', 'capitao-da-guarda-kalis-base', 'capitao-da-guarda-ridan-base',
  'road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base', 'rival-a-base', 'rival-b-base', 'rival-female-base',
  'guardian-healer-male-base', 'guardian-healer-female-base', 'passage-guardian-base',
  'saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii',
  'guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c',
  'jung-de-grimoria-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii',
  'protagonist-main-transformed', 'rival-b-final-mode', 'legendary-beast-premium',
];
beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await migrate(pool); await seedDatabase(pool); });
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });

it('migra catálogo e missões para a ordem da campanha mesmo após reordenação CMS, preservando o estado do jogador', async () => {
  const base = (await cms.catalog()).characters.find((u) => u.id === 'protagonist-main-base')!;
  await cms.save('characters', { ...base, id: 'cms-roster-extra', characterId: 'cms-roster-extra', name: 'Extra CMS',
    unlock: { kind: 'premium', description: 'Extra.' }, priceUsd: 9.9 }, true);
  const previous = (await cms.catalog()).characters.map((u) => u.id).reverse();
  await cms.reorderCharacters(previous);
  const before = await cms.catalog();
  const user = await auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) });
  await game.setTeamSlot(user.id, 0, 'protagonist-main-base');
  const battle = await new PostgresBattleRepository(pool).startBattle(user.id, 'path-1-encounter-1');
  const progress = await auth.getProgress(user.id);
  await pool.query("DELETE FROM schema_migrations WHERE name='048_campaign_roster_order.sql'");
  await migrate(pool);
  await seedDatabase(pool);
  const catalog = await game.getCatalog();
  expect(catalog.units.slice(0, 26).map((u) => u.id)).toEqual(ordered);
  const missions = await game.getCharacterUnlocks(user.id);
  const remaining = previous.filter((id) => !ordered.includes(id));
  expect(missions.characters.filter((u) => u.kind === 'battle-wins').map((u) => u.id))
    .toEqual([...ordered.filter((id) => !['protagonist-main-base', 'protagonist-secondary-base', 'protagonist-female-base'].includes(id)),
      ...remaining.filter((id) => !['maga-artemis', 'cms-roster-extra'].includes(id))]);
  expect((await cms.catalog()).characters.slice(26).map((u) => u.id)).toEqual(remaining);
  const withoutOrder = (characters: typeof before.characters) => characters.map(({ rosterOrder: _order, ...u }) => u).sort((a, b) => a.id.localeCompare(b.id));
  expect(withoutOrder((await cms.catalog()).characters)).toEqual(withoutOrder(before.characters));
  expect(await auth.getProgress(user.id)).toEqual(progress);
  expect((await pool.query('SELECT state FROM battles WHERE id=$1', [battle.id])).rows[0].state).toEqual(battle.state);
  await migrate(pool);
  expect((await game.getCatalog()).units.slice(0, 26).map((u) => u.id)).toEqual(ordered);
});
