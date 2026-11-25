import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { abilities } from '@game/content/abilities.js';
import { createBattle } from '@game/core/battle.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresGameRepository } from './game-repository.js';
import { CmsRepository } from '../../../cms/server/repository.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const schema = `ability_update_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
const game = new PostgresGameRepository(pool);
const cms = new CmsRepository(pool);
const loadouts = [
  ['rival-a-base', ['simple-strike', 'guard', 'retain-energy', 'retaliation']],
  ['passage-guardian-base', ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'extra-turn']],
  ['guerreiros-habilidosos-a', ['simple-strike-ii', 'guard', 'retain-energy-plus', 'secondary-special']],
  ['guerreiros-habilidosos-b', ['simple-strike-ii', 'guard', 'retain-energy', 'divine-protection']],
  ['guerreiros-habilidosos-c', ['simple-strike-ii', 'guard', 'retain-energy', 'wolfs-howl']],
  ['protagonist-main-transformed', ['quick-slash', 'female-special', 'retain-energy-plus', 'fury-scream']],
  ['legendary-beast-premium', ['heal-plus', 'divine-protection', 'retain-energy-plus', 'resurrection']],
] as const;

beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(pool);
  await seedDatabase(pool);
});
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

it('inicializa um banco vazio com o balanceamento e os novos conjuntos', async () => {
  const catalog = await game.getCatalog();
  expect(catalog.abilities.find((a) => a.id === 'fast-move')?.energyCost).toBe(25);
  for (const [id, abilityIds] of loadouts) expect(catalog.units.find((u) => u.id === id)?.abilityIds).toEqual(abilityIds);
});

it('migra conteúdo anterior mesmo com edições CMS, preservando campos alheios, snapshots e futuras edições', async () => {
  const originals = [
    ['rival-a-base', ['simple-strike', 'guard', 'retain-energy', 'main-special']],
    ['passage-guardian-base', ['main-special', 'fast-move', 'retain-energy', 'extra-turn']],
    ['guerreiros-habilidosos-a', ['main-special', 'fast-move', 'retain-energy', 'secondary-special']],
    ['guerreiros-habilidosos-b', ['main-special', 'fast-move', 'retain-energy', 'female-special']],
    ['guerreiros-habilidosos-c', ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'secondary-special']],
    ['protagonist-main-transformed', ['simple-strike-ii', 'female-special', 'retain-energy-plus', 'fury-scream']],
    ['legendary-beast-premium', ['heal-plus', 'female-special', 'retain-energy-plus', 'resurrection']],
  ] as const;
  for (const [id, ids] of originals) {
    await pool.query('DELETE FROM unit_abilities WHERE unit_id=$1', [id]);
    for (const [slot, abilityId] of ids.entries()) await pool.query('INSERT INTO unit_abilities VALUES ($1,$2,$3)', [id, slot, abilityId]);
  }
  await pool.query("DELETE FROM abilities WHERE id IN ('divine-protection','retaliation','wolfs-howl')");
  await pool.query("UPDATE abilities SET energy_cost=15 WHERE id='fast-move'");
  await pool.query(`UPDATE abilities SET effects='[{"kind":"heal","amount":20}]', description='Cura antiga' WHERE id='heal'`);
  const drak = (await cms.catalog()).characters.find((u) => u.id === 'passage-guardian-base')!;
  await cms.save('characters', { ...drak, name: 'Drak editado no CMS', maxHp: 180 }, false);
  const heal = (await cms.catalog()).abilities.find((a) => a.id === 'heal')!;
  await cms.save('abilities', { ...heal, name: 'Cura editada no CMS' }, false);
  const before = await game.getCatalog();
  const snapshot = createBattle([before.units.find((u) => u.id === 'passage-guardian-base')!], [before.units[0]], before.abilities);
  // Mesmo JSON persistido por partidas oficiais, em tabela isolada do teste.
  await pool.query('CREATE TABLE saved_snapshot (state jsonb NOT NULL)');
  await pool.query('INSERT INTO saved_snapshot VALUES ($1)', [JSON.stringify(snapshot)]);
  await pool.query("DELETE FROM schema_migrations WHERE name='044_divine_protection_retaliation_and_wolfs_howl.sql'");
  await migrate(pool);
  await seedDatabase(pool);
  await migrate(pool);
  const catalog = await game.getCatalog();
  expect(catalog.abilities.find((a) => a.id === 'fast-move')?.energyCost).toBe(25);
  expect(catalog.abilities.find((a) => a.id === 'heal')).toMatchObject({ name: 'Cura editada no CMS', effects: [{ kind: 'heal', amount: 25 }] });
  expect(catalog.units.find((u) => u.id === drak.id)).toMatchObject({ name: 'Drak editado no CMS', maxHp: 180 });
  for (const [id, abilityIds] of loadouts) expect(catalog.units.find((u) => u.id === id)?.abilityIds).toEqual(abilityIds);
  for (const id of ['divine-protection', 'retaliation', 'wolfs-howl'] as const) {
    expect(catalog.abilities.find((a) => a.id === id)).toEqual(abilities[id]);
  }
  expect((await pool.query('SELECT state FROM saved_snapshot')).rows[0].state).toEqual(snapshot);
  const divine = catalog.abilities.find((a) => a.id === 'divine-protection')!;
  await cms.save('abilities', { ...divine, energyCost: 42 }, false);
  await migrate(pool);
  await seedDatabase(pool);
  expect((await game.getCatalog()).abilities.find((a) => a.id === divine.id)?.energyCost).toBe(42);
});

it('altera somente a quantidade de cura preservando efeitos adicionais e sua ordem no CMS', async () => {
  const heal = (await cms.catalog()).abilities.find((a) => a.id === 'heal')!;
  await cms.save('abilities', { ...heal, effects: [{ kind: 'guard', reduction: 7, teamTurns: 2 }, { kind: 'heal', amount: 20 }] }, false);
  await pool.query("DELETE FROM schema_migrations WHERE name='044_divine_protection_retaliation_and_wolfs_howl.sql'");
  await migrate(pool);
  await seedDatabase(pool);
  expect((await game.getCatalog()).abilities.find((a) => a.id === 'heal')?.effects)
    .toEqual([{ kind: 'guard', reduction: 7, teamTurns: 2 }, { kind: 'heal', amount: 25 }]);
});

it('resolve destinos já presentes no conjunto CMS sem violar unicidade nem perder os quatro slots', async () => {
  const drak = (await cms.catalog()).characters.find((u) => u.id === 'passage-guardian-base')!;
  await cms.save('characters', { ...drak, abilityIds: ['main-special', 'simple-strike-ii', 'retain-energy', 'retain-energy-plus'] }, false);
  await pool.query("DELETE FROM schema_migrations WHERE name='044_divine_protection_retaliation_and_wolfs_howl.sql'");
  await migrate(pool);
  await seedDatabase(pool);
  expect((await game.getCatalog()).units.find((u) => u.id === drak.id)?.abilityIds)
    .toEqual(['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'extra-turn']);
});
