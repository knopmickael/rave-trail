import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createBattle } from '@game/core/battle.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { CmsRepository } from '../../../cms/server/repository.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const schema = 'new_abilities_' + randomUUID().replaceAll('-', '');
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
const cms = new CmsRepository(pool);
const migration = '055_burn_reflection_and_concentration.sql';
beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await migrate(pool); await seedDatabase(pool); });
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });

it('disponibiliza as cinco novas habilidades no catálogo do banco e do CMS', async () => {
  const catalog = await cms.catalog();
  for (const id of ['damage-reflection', 'deep-concentration', 'dragons-roar', 'seismic-explosion', 'frozen-throne']) {
    expect(catalog.abilities.find((a) => a.id === id), id).toBeDefined();
  }
  expect(catalog.abilities.find((a) => a.id === 'quick-slash')).toMatchObject({ energyCost: 35, effects: [{ kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 5, turns: 3 }] });
  expect(catalog.abilities.find((a) => a.id === 'fury-scream')).toMatchObject({ energyCost: 60, effects: [{ kind: 'damage', amount: 45 }] });
});

it('migra conteúdo anterior com autoria, preserva extras e snapshots e respeita futuras edições', async () => {
  const catalog = await cms.catalog();
  const quick = catalog.abilities.find((a) => a.id === 'quick-slash')!;
  const howl = catalog.abilities.find((a) => a.id === 'wolfs-howl')!;
  const fury = catalog.abilities.find((a) => a.id === 'fury-scream')!;
  await cms.save('abilities', { ...quick, name: 'Corte personalizado', energyCost: 30, effects: [
    { kind: 'damage', amount: 20 }, { kind: 'bleed', amount: 5, turns: 3 }, { kind: 'attack-block', teamTurns: 1 }, { kind: 'damage', amount: 8 },
  ] }, false);
  await cms.save('abilities', { ...howl, name: 'Uivo personalizado', effects: [
    { kind: 'damage', amount: 20 }, { kind: 'ability-block', teamTurns: 1 }, { kind: 'bleed', amount: 2, turns: 1 }, { kind: 'ability-block', teamTurns: 2 },
  ] }, false);
  await cms.save('abilities', { ...fury, energyCost: 45, effects: [{ kind: 'damage', amount: 35 }] }, false);
  const old = await cms.catalog();
  const unit = old.characters[0];
  const snapshot = createBattle([{ ...unit, abilityIds: ['quick-slash', 'wolfs-howl', 'fury-scream', 'guard'] }],
    [{ ...old.characters[1], abilityIds: ['simple-strike', 'guard', 'heal', 'retain-energy'] }], old.abilities);
  await pool.query('CREATE TABLE saved_snapshot (state jsonb NOT NULL)');
  await pool.query('INSERT INTO saved_snapshot VALUES ($1)', [JSON.stringify(snapshot)]);
  await pool.query('DELETE FROM schema_migrations WHERE name=$1', [migration]);
  await migrate(pool); await seedDatabase(pool); await migrate(pool);
  const next = await cms.catalog();
  expect(next.abilities.find((a) => a.id === quick.id)).toMatchObject({ name: 'Corte personalizado', energyCost: 35, effects: [
    { kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 5, turns: 3 }, { kind: 'attack-block', teamTurns: 1 }, { kind: 'damage', amount: 8 },
  ] });
  expect(next.abilities.find((a) => a.id === howl.id)).toMatchObject({ name: 'Uivo personalizado', effects: [
    { kind: 'damage', amount: 25 }, { kind: 'burn', teamTurns: 3 }, { kind: 'bleed', amount: 2, turns: 1 }, { kind: 'ability-block', teamTurns: 2 },
  ] });
  expect((await pool.query('SELECT state FROM saved_snapshot')).rows[0].state).toEqual(snapshot);
  const reflection = next.abilities.find((a) => a.id === 'damage-reflection')!;
  await cms.save('abilities', { ...reflection, energyCost: 42 }, false);
  await seedDatabase(pool); await migrate(pool);
  expect((await cms.catalog()).abilities.find((a) => a.id === reflection.id)?.energyCost).toBe(42);
});

it('restaura o dano inicial obrigatório quando a autoria anterior continha somente outros efeitos', async () => {
  const catalog = await cms.catalog();
  for (const id of ['quick-slash', 'wolfs-howl', 'fury-scream']) {
    await cms.save('abilities', { ...catalog.abilities.find((a) => a.id === id)!, effects: [{ kind: 'bleed', amount: 4, turns: 2 }] }, false);
  }
  await pool.query('DELETE FROM schema_migrations WHERE name=$1', [migration]);
  await migrate(pool);
  const next = await cms.catalog();
  expect(next.abilities.find((a) => a.id === 'quick-slash')?.effects).toEqual([{ kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 4, turns: 2 }]);
  expect(next.abilities.find((a) => a.id === 'wolfs-howl')?.effects).toEqual([{ kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 4, turns: 2 }, { kind: 'burn', teamTurns: 3 }]);
  expect(next.abilities.find((a) => a.id === 'fury-scream')?.effects).toEqual([{ kind: 'damage', amount: 45 }, { kind: 'bleed', amount: 4, turns: 2 }]);
});
