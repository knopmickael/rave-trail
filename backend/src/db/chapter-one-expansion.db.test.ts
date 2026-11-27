import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { units } from '@game/content/units.js';
import { abilities } from '@game/content/abilities.js';
import { encounters } from '@game/content/encounters.js';
import { battleUnlockRules } from '@game/content/unlocks.js';
import { createBattle } from '@game/core/battle.js';
import { migrate } from './test-migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresGameRepository } from './game-repository.js';
import { CmsRepository } from '../../../cms/server/repository.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const schema = `chapter_expansion_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
const game = new PostgresGameRepository(pool);
const cms = new CmsRepository(pool);
beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await migrate(pool); await seedDatabase(pool); });
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });

it('inicializa o novo conteúdo e o balanceamento no banco vazio', async () => {
  const catalog = await game.getCatalog();
  expect(catalog.abilities.find((a) => a.id === 'quick-slash')).toMatchObject({ energyCost: 35, effects: [{ kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 5, turns: 3 }] });
  expect(catalog.abilities.find((a) => a.id === 'resurrection')?.effects).toEqual([{ kind: 'revive', hpRatio: 1 }]);
  for (const id of ['passage-guardian-base', 'guerreiros-habilidosos-a', 'jung-de-grimoria-ii']) {
    expect(catalog.units.find((u) => u.id === id)?.abilityIds).toEqual(units.find((u) => u.id === id)!.abilityIds);
  }
  for (const id of ['saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii']) {
    expect(catalog.units.find((u) => u.id === id)?.maxHp).toBe(100);
  }
});

it('atualiza catálogo e missões editadas sem reescrever snapshots nem campos não solicitados', async () => {
  const before = await game.getCatalog();
  const snapshot = createBattle([before.units[0]], [before.units[1]], before.abilities);
  await pool.query('CREATE TABLE saved_snapshot (state jsonb NOT NULL)');
  await pool.query('INSERT INTO saved_snapshot VALUES ($1)', [JSON.stringify(snapshot)]);
  const drak = (await cms.catalog()).characters.find((u) => u.id === 'passage-guardian-base')!;
  await cms.save('characters', { ...drak, name: 'Drak personalizado', maxHp: 170, abilityIds: ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'extra-turn'] }, false);
  const slash = before.abilities.find((a) => a.id === 'quick-slash')!;
  await cms.save('abilities', { ...slash, energyCost: 35, effects: [{ kind: 'damage', amount: 24 }, { kind: 'bleed', amount: 10, turns: 3 }, { kind: 'attack-block', teamTurns: 1 }] }, false);
  await pool.query("UPDATE units SET unlock_rule='{\"unitId\":\"guerreiros-habilidosos-a\",\"availableAfterEncounterId\":\"path-1-encounter-4\",\"requirements\":[]}' WHERE id='guerreiros-habilidosos-a'");
  await pool.query("DELETE FROM schema_migrations WHERE name IN ('046_chapter_one_expansion.sql','049_execution_and_heal_plus_energy.sql')");
  await migrate(pool); await seedDatabase(pool); await migrate(pool);
  const updated = await game.getCatalog();
  expect(updated.units.find((u) => u.id === drak.id)).toMatchObject({ name: 'Drak personalizado', maxHp: 170, abilityIds: ['simple-strike', 'guard', 'retain-energy-plus', 'extra-turn'] });
  expect(updated.abilities.find((a) => a.id === slash.id)).toMatchObject({ energyCost: 30, effects: [{ kind: 'damage', amount: 24 }, { kind: 'bleed', amount: 5, turns: 3 }, { kind: 'attack-block', teamTurns: 1 }] });
  const authored = await cms.catalog();
  for (const id of ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c', 'jung-de-grimoria-ii', 'protagonist-main-transformed', 'saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii']) {
    expect(authored.characters.find((u) => u.id === id)?.unlockRule).toEqual(battleUnlockRules.find((r) => r.unitId === id));
  }
  for (const encounter of encounters.filter((e) => e.campaignId === 'path-1' && e.position >= 4 && e.position <= 6)) {
    expect(authored.encounters.find((e) => e.id === encounter.id)?.enemyUnitIds).toEqual(encounter.enemyUnitIds);
  }
  expect((await pool.query('SELECT state FROM saved_snapshot')).rows[0].state).toEqual(snapshot);
  expect(updated.abilities.find((a) => a.id === 'divine-boon')).toEqual(abilities['divine-boon']);
});

it('preserva a posição de um personagem CMS que já ocupava o fim do catálogo antes da expansão', async () => {
  const additions = ['saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii'];
  await pool.query('DELETE FROM encounter_enemies WHERE unit_id=ANY($1::text[])', [additions]);
  await pool.query('DELETE FROM unit_abilities WHERE unit_id=ANY($1::text[])', [additions]);
  await pool.query('DELETE FROM units WHERE id=ANY($1::text[])', [additions]);
  // Reconstitui as 38 posições legadas antes de adicionar o personagem do CMS.
  await pool.query('UPDATE units SET roster_order=roster_order+1000 WHERE roster_order IS NOT NULL');
  await pool.query(`WITH ranked AS (SELECT id,(row_number() OVER (ORDER BY roster_order NULLS LAST,id)-1)::int AS position FROM units)
    UPDATE units u SET roster_order=ranked.position FROM ranked WHERE ranked.id=u.id`);
  const base = (await cms.catalog()).characters.find((u) => u.id === 'protagonist-main-base')!;
  await cms.save('characters', { ...base, id: 'cms-order-test-character', characterId: 'cms-order-test-narrative', name: 'Personagem de autoria' }, true);
  expect((await cms.catalog()).characters.find((u) => u.id === 'cms-order-test-character')?.rosterOrder).toBe(38);
  await pool.query("DELETE FROM schema_migrations WHERE name IN ('046_chapter_one_expansion.sql','049_execution_and_heal_plus_energy.sql')");
  await migrate(pool);
  await seedDatabase(pool);
  await seedDatabase(pool);
  const catalog = await cms.catalog();
  expect(catalog.characters.find((u) => u.id === 'cms-order-test-character')?.rosterOrder).toBe(38);
  expect(catalog.characters.filter((u) => additions.includes(u.id)).map((u) => u.rosterOrder)).toEqual([14, 15, 16, 21, 22]);
});
