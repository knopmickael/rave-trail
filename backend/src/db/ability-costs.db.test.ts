import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createBattle } from '@game/core/battle.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresGameRepository } from './game-repository.js';
import { CmsRepository } from '../../../cms/server/repository.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const schema = `ability_costs_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
const game = new PostgresGameRepository(pool);
const cms = new CmsRepository(pool);
beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await migrate(pool); await seedDatabase(pool); });
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });

it('um banco novo usa os custos atuais de Execução, cura, drenagem e Vórtex negro', async () => {
  const catalog = await game.getCatalog();
  expect(catalog.abilities.find((a) => a.id === 'execution')?.energyCost).toBe(50);
  expect(catalog.abilities.find((a) => a.id === 'heal-plus')?.energyCost).toBe(50);
  expect(catalog.abilities.find((a) => a.id === 'soul-drain-plus')?.energyCost).toBe(60);
  expect(catalog.abilities.find((a) => a.id === 'dark-vortex')?.energyCost).toBe(35);
});

it('a migration altera somente os custos, preserva autoria e snapshots e não é desfeita pelo seed', async () => {
  const catalog = await game.getCatalog();
  const execution = catalog.abilities.find((a) => a.id === 'execution')!;
  const healing = catalog.abilities.find((a) => a.id === 'heal-plus')!;
  const draining = catalog.abilities.find((a) => a.id === 'soul-drain-plus')!;
  const vortex = catalog.abilities.find((a) => a.id === 'dark-vortex')!;
  await cms.save('abilities', { ...execution, name: 'Execução editada', energyCost: 40 }, false);
  await cms.save('abilities', { ...healing, description: 'Cura editada no CMS.', energyCost: 45 }, false);
  await cms.save('abilities', { ...draining, name: 'Drenagem editada', energyCost: 45 }, false);
  await cms.save('abilities', { ...vortex, description: 'Vórtex editado no CMS.', energyCost: 30 }, false);
  const previous = await game.getCatalog();
  const snapshot = createBattle([previous.units[0]], [previous.units[1]], previous.abilities);
  await pool.query('CREATE TABLE saved_snapshot (state jsonb NOT NULL)');
  await pool.query('INSERT INTO saved_snapshot VALUES ($1)', [JSON.stringify(snapshot)]);
  await pool.query("DELETE FROM schema_migrations WHERE name IN ('049_execution_and_heal_plus_energy.sql','051_existence_drain_and_dark_vortex_energy.sql')");
  await migrate(pool); await seedDatabase(pool); await migrate(pool);
  const current = await game.getCatalog();
  expect(current.abilities.find((a) => a.id === 'execution')).toEqual({ ...execution, name: 'Execução editada', energyCost: 50 });
  expect(current.abilities.find((a) => a.id === 'heal-plus')).toEqual({ ...healing, description: 'Cura editada no CMS.', energyCost: 50 });
  expect(current.abilities.find((a) => a.id === 'soul-drain-plus')).toEqual({ ...draining, name: 'Drenagem editada', energyCost: 60 });
  expect(current.abilities.find((a) => a.id === 'dark-vortex')).toEqual({ ...vortex, description: 'Vórtex editado no CMS.', energyCost: 35 });
  expect((await pool.query('SELECT state FROM saved_snapshot')).rows[0].state).toEqual(snapshot);
});
