import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CmsRepository } from './repository';
import { CmsMigrationWriter } from './migration-writer';
import { createCmsApp } from './app';
import { migrate } from '../../backend/src/db/migrations';
import { seedDatabase } from '../../backend/src/db/seed';
import { PostgresAuthRepository } from '../../backend/src/db/auth-repository';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const admin = new pg.Pool({ connectionString: url });
let source: pg.Pool;
let target: pg.Pool;
let schemas: string[];
let directory: string;
let repo: CmsRepository;

beforeEach(async () => {
  schemas = ['cms_source_', 'cms_target_'].map((prefix) => prefix + randomUUID().replaceAll('-', ''));
  for (const schema of schemas) await admin.query(`CREATE SCHEMA ${schema}`);
  [source, target] = schemas.map((schema) => new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` }));
  for (const pool of [source, target]) { await migrate(pool); await seedDatabase(pool); }
  directory = await mkdtemp(join(tmpdir(), 'rave-cms-migrations-'));
  repo = new CmsRepository(source, pathToFileURL(directory + '/'));
}, 30000); // Each case migrates and seeds two independent schemas, including under CI load.
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  await source.end(); await target.end();
  for (const schema of schemas) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await rm(directory, { recursive: true, force: true });
});

it('mantém saves em ordem mesmo no mesmo milissegundo e não exporta transações inválidas', async () => {
  const ability = (await repo.catalog()).abilities.find((a) => a.id === 'heal')!;
  vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
  await repo.save('abilities', { ...ability, energyCost: 11 }, false);
  await repo.save('abilities', { ...ability, energyCost: 22 }, false);
  const unit = (await repo.catalog()).characters[0];
  await expect(repo.save('characters', { ...unit, abilityIds: ['heal', 'heal', 'guard', 'simple-strike'] }, false)).rejects.toMatchObject({ code: '23505' });
  expect(await readdir(directory)).toHaveLength(2);
  expect((await source.query('SELECT count(*)::int AS count FROM cms_migration_journal')).rows[0].count).toBe(2);
  await replay();
  expect((await target.query("SELECT energy_cost FROM abilities WHERE id='heal'")).rows[0].energy_cost).toBe(22);
});

async function targetPlayer() {
  return new PostgresAuthRepository(target).register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) });
}

it('desabilitar limpa equipes e confrontos exclusivos do destino, sem exportar IDs de jogadores locais', async () => {
  const user = await targetPlayer();
  await target.query('UPDATE player_team_slots SET unit_id=$1 WHERE user_id=$2 AND slot_index=0', ['protagonist-main-base', user.id]);
  await target.query("INSERT INTO encounters (id,campaign_id,position,title,story,map_x,map_y) VALUES ('target-only','path-1',99,'Destino','Teste',0,0)");
  await target.query("INSERT INTO encounter_enemies VALUES ('target-only',0,'protagonist-main-base')");
  const unit = (await repo.catalog()).characters.find((c) => c.id === 'protagonist-main-base')!;
  await repo.save('characters', { ...unit, enabled: false }, false);
  await replay();
  expect((await target.query('SELECT unit_id FROM player_team_slots WHERE user_id=$1 AND slot_index=0', [user.id])).rows[0].unit_id).toBeNull();
  expect((await target.query("SELECT 1 FROM encounter_enemies WHERE encounter_id='target-only'")).rowCount).toBe(0);
  expect((await target.query("SELECT 1 FROM cms_content_overrides WHERE entity='encounters' AND id='target-only'")).rowCount).toBe(1);
  expect((await target.query('SELECT revision FROM player_progress WHERE user_id=$1', [user.id])).rows[0].revision).toBeGreaterThan(0);
  const sql = await readFile(join(directory, (await readdir(directory))[0]), 'utf8');
  expect(sql).not.toContain(user.id);
});

it('revalida histórico de produção antes de excluir uma habilidade e reverte a migration inteira', async () => {
  const ability = (await repo.catalog()).abilities[0];
  await repo.save('abilities', { ...ability, id: 'cms-new-ability' }, true);
  await replay();
  const user = await targetPlayer();
  await target.query("INSERT INTO battles (id,user_id,state,status,mode) VALUES ($1,$2,$3,'victory','quick')", [randomUUID(), user.id, JSON.stringify({ abilities: { 'cms-new-ability': ability } })]);
  await repo.remove('abilities', 'cms-new-ability');
  await expect(replay()).rejects.toThrow();
  expect((await target.query("SELECT 1 FROM abilities WHERE id='cms-new-ability'")).rowCount).toBe(1);
  expect((await target.query("SELECT deleted FROM cms_content_overrides WHERE entity='abilities' AND id='cms-new-ability'")).rows[0].deleted).toBe(false);
});

it('recupera SQL após falha de exportação depois do commit sem precisar repetir a edição', async () => {
  const original = CmsMigrationWriter.prototype.exportPending;
  let calls = 0;
  vi.spyOn(CmsMigrationWriter.prototype, 'exportPending').mockImplementation(async function (this: CmsMigrationWriter, client) {
    if (++calls === 2) throw new Error('Disco indisponível');
    return original.call(this, client);
  });
  const ability = (await repo.catalog()).abilities[0];
  await expect(repo.save('abilities', { ...ability, name: 'Salvo antes da falha' }, false)).rejects.toThrow('Alteração salva no banco local');
  expect(await readdir(directory)).toHaveLength(0);
  expect((await source.query('SELECT name FROM abilities WHERE id=$1', [ability.id])).rows[0].name).toBe('Salvo antes da falha');
  await new CmsRepository(source, pathToFileURL(directory + '/')).flushMigrations();
  expect(await readdir(directory)).toHaveLength(1);
  await replay();
  expect((await target.query('SELECT name FROM abilities WHERE id=$1', [ability.id])).rows[0].name).toBe('Salvo antes da falha');
});

it('não sobrescreve uma migration existente com bytes diferentes', async () => {
  const ability = (await repo.catalog()).abilities[0];
  await repo.save('abilities', ability, false);
  const name = (await readdir(directory))[0];
  const sql = await readFile(join(directory, name), 'utf8');
  await source.query('UPDATE cms_migration_journal SET exported_at=NULL');
  await writeFile(join(directory, name), '-- outro conteúdo\n');
  await expect(repo.flushMigrations()).rejects.toThrow();
  expect(await readFile(join(directory, name), 'utf8')).toBe('-- outro conteúdo\n');
  await writeFile(join(directory, name), sql);
  await repo.flushMigrations();
  expect((await source.query('SELECT 1 FROM cms_migration_journal WHERE exported_at IS NULL')).rowCount).toBe(0);
});

it('exporta mídia binária e CRUD de setups pelo perfil local da API', async () => {
  vi.stubEnv('CMS_PROFILE', 'local');
  const app = createCmsApp(source, 'http://127.0.0.1:5188', 3188, pathToFileURL(directory + '/'));
  try {
    const status = await app.inject({ url: '/api/status', headers: { host: '127.0.0.1:5188' } });
    const headers = { host: '127.0.0.1:5188', origin: 'http://127.0.0.1:5188', 'x-cms-token': status.json().token };
    const content = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64');
    const image = await app.inject({ method: 'POST', url: '/api/media', headers, payload: { base64: content.toString('base64') } });
    expect(image.statusCode).toBe(201);
    const setup = { id: 'new-setup', name: "Proteção d'água", config: { energyCost: 10, target: 'self', effects: [{ kind: 'guard', reduction: 10, teamTurns: 2 }] } };
    expect((await app.inject({ method: 'POST', url: '/api/setups', headers, payload: setup })).statusCode).toBe(200);
    await replay();
    const mediaId = image.json().path.split('/').pop();
    expect((await target.query('SELECT content FROM cms_media WHERE id=$1', [mediaId])).rows[0].content.equals(content)).toBe(true);
    expect((await target.query('SELECT name FROM cms_ability_setups WHERE id=$1', [setup.id])).rows[0].name).toBe("Proteção d'água");
    expect((await app.inject({ method: 'DELETE', url: '/api/setups/new-setup', headers })).statusCode).toBe(200);
    await replay();
    expect((await target.query("SELECT 1 FROM cms_ability_setups WHERE id='new-setup'")).rowCount).toBe(0);
    expect(await readdir(directory)).toHaveLength(3);
  } finally { await app.close(); }
});

it.each(['prod', undefined])('perfil %s não gera arquivos nem journal', async (profile) => {
  if (profile) vi.stubEnv('CMS_PROFILE', profile); else vi.stubEnv('CMS_PROFILE', undefined);
  const app = createCmsApp(source, 'http://127.0.0.1:5188', 3188, pathToFileURL(directory + '/'));
  try {
    const status = await app.inject({ url: '/api/status', headers: { host: '127.0.0.1:5188' } });
    const ability = (await repo.catalog()).abilities[0];
    const headers = { host: '127.0.0.1:5188', origin: 'http://127.0.0.1:5188', 'x-cms-token': status.json().token };
    expect((await app.inject({ method: 'PUT', url: `/api/abilities/${ability.id}`, headers, payload: ability })).statusCode).toBe(200);
    expect(await readdir(directory)).toHaveLength(0);
    expect((await source.query('SELECT 1 FROM cms_migration_journal')).rowCount).toBe(0);
  } finally { await app.close(); }
});

it('reproduz criação, movimentação e exclusão de confrontos, além da ordem do catálogo', async () => {
  await repo.save('campaigns', { id: 'cms-campaign', title: 'Nova', description: 'História', chapterNumber: 100, sortOrder: 100,
    background: '/media/test.png', mapBackground: null, prerequisiteEncounterId: null, released: true }, true);
  const encounter = { id: 'cms-first', campaignId: 'cms-campaign', position: 1, title: 'Primeira', story: "História $1 d'água \\ fim",
    enemyUnitIds: ['protagonist-main-base'], mapX: 1, mapY: 2 };
  await repo.save('encounters', encounter, true);
  await repo.save('encounters', { ...encounter, id: 'cms-second', position: 2, enemyUnitIds: ['road-raider-1-base'] }, true);
  await repo.save('encounters', { ...encounter, id: 'cms-second', position: 1 }, false);
  await replay();
  const targetRepo = new CmsRepository(target);
  expect((await targetRepo.catalog()).encounters.filter((e) => e.campaignId === 'cms-campaign').map((e) => e.id)).toEqual(['cms-second', 'cms-first']);
  await repo.remove('encounters', 'cms-first');
  const ids = (await repo.catalog()).characters.map((c) => c.id).reverse();
  await repo.reorderCharacters(ids);
  await replay();
  expect((await targetRepo.catalog()).characters.map((c) => c.id)).toEqual(ids);
  expect((await targetRepo.catalog()).encounters.find((e) => e.id === 'cms-second')).toMatchObject({ position: 1, story: "História $1 d'água \\ fim" });
  expect((await target.query("SELECT deleted FROM cms_content_overrides WHERE entity='encounters' AND id='cms-first'")).rows[0].deleted).toBe(true);
});

it('aplica uma migration de skillset também em um banco novo antes do seed normal', async () => {
  const unit = (await repo.catalog()).characters.find((c) => c.id === 'protagonist-main-base')!;
  await repo.save('characters', { ...unit, abilityIds: ['heal', 'guard', 'retain-energy', 'simple-strike'] }, false);
  // Simula um deploy novo: migrations estruturais aplicadas, catálogo ainda não semeado.
  await target.query('TRUNCATE narrative_characters,abilities,campaigns CASCADE');
  await replay();
  await seedDatabase(target);
  expect((await new CmsRepository(target).catalog()).characters.find((c) => c.id === unit.id)?.abilityIds).toEqual(['heal', 'guard', 'retain-energy', 'simple-strike']);
});

it.each(['save', 'remove'])('rejeita %s de confronto quando o destino tem encontros adicionais, preservando posições', async (action) => {
  await repo.save('campaigns', { id: 'cms-campaign', title: 'Nova', description: 'História', chapterNumber: 100, sortOrder: 100,
    background: '/media/test.png', mapBackground: null, prerequisiteEncounterId: null, released: true }, true);
  const encounter = { id: 'cms-first', campaignId: 'cms-campaign', position: 1, title: 'Primeira', story: 'Original',
    enemyUnitIds: ['protagonist-main-base'], mapX: 1, mapY: 2 };
  await repo.save('encounters', encounter, true);
  await replay();
  await target.query("INSERT INTO encounters (id,campaign_id,position,title,story,map_x,map_y) VALUES ('target-only','cms-campaign',2,'Destino','Teste',0,0)");
  if (action === 'save') await repo.save('encounters', { ...encounter, story: 'Nova história' }, false);
  else await repo.remove('encounters', encounter.id);
  await expect(replay()).rejects.toThrow();
  expect((await target.query("SELECT id,position,story FROM encounters WHERE campaign_id='cms-campaign' ORDER BY position")).rows).toEqual([
    { id: 'cms-first', position: 1, story: 'Original' }, { id: 'target-only', position: 2, story: 'Teste' },
  ]);
});

it('rejeita reordenação quando o destino tem personagens adicionais, preservando todas as posições', async () => {
  const targetRepo = new CmsRepository(target);
  const unit = (await targetRepo.catalog()).characters.find((c) => c.id === 'protagonist-main-base')!;
  await targetRepo.save('characters', { ...unit, id: 'target-only-unit' }, true);
  const before = (await targetRepo.catalog()).characters.map((c) => [c.id, c.rosterOrder]);
  await repo.reorderCharacters((await repo.catalog()).characters.map((c) => c.id).reverse());
  await expect(replay()).rejects.toThrow();
  expect((await targetRepo.catalog()).characters.map((c) => [c.id, c.rosterOrder])).toEqual(before);
});
afterAll(() => admin.end());

async function replay() { await migrate(target, pathToFileURL(directory + '/')); }

it('gera migration de skillset aplicada localmente e reproduz os quatro slots pelo migrador de deploy', async () => {
  const unit = (await repo.catalog()).characters.find((c) => c.id === 'protagonist-main-base')!;
  await repo.save('characters', { ...unit, name: "Jung d'água \\ $1", abilityIds: ['heal', 'guard', 'retain-energy', 'simple-strike'] }, false);
  const files = await readdir(directory);
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/\.sql$/);
  expect((await source.query('SELECT 1 FROM schema_migrations WHERE name=$1', [files[0]])).rowCount).toBe(1);
  await replay();
  await seedDatabase(target);
  const copy = (await new CmsRepository(target).catalog()).characters.find((c) => c.id === unit.id)!;
  expect(copy.abilityIds).toEqual(['heal', 'guard', 'retain-energy', 'simple-strike']);
  expect(copy.name).toBe("Jung d'água \\ $1");
  await replay();
  expect((await target.query('SELECT 1 FROM schema_migrations WHERE name=$1', [files[0]])).rowCount).toBe(1);
});
