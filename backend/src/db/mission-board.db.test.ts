import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { missionBoardRules } from '@game/content/unlocks.js';
import { migrate } from './migrations.js';
import { seedDatabase } from './seed.js';
import { PostgresAuthRepository } from './auth-repository.js';
import { PostgresGameRepository } from './game-repository.js';
import { compactCompletedBattles } from './battle-compaction.js';
import { CmsRepository } from '../../../cms/server/repository.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || url === process.env.DATABASE_URL) throw new Error('Banco exclusivo _test obrigatório.');
const schema = 'mission_board_' + randomUUID().replaceAll('-', '');
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
const cms = new CmsRepository(pool), auth = new PostgresAuthRepository(pool), game = new PostgresGameRepository(pool);
beforeAll(async () => { await admin.query(`CREATE SCHEMA ${schema}`); await migrate(pool); await seedDatabase(pool); });
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
const player = () => auth.register(`${randomUUID()}@example.com`, 'hash', { tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000) });

async function win(userId: string, enemies: string[], allies: string[], noDeaths: boolean | undefined = undefined, count = 1) {
  const state = { status: 'victory', turn: 3, activeSide: 'player', teams: {
    player: { turns: 2, units: allies.map((unitId) => ({ unitId, hp: 100, ...(noDeaths !== undefined ? { wasDefeated: !noDeaths } : {}) })) },
    enemy: { turns: 1, units: enemies.map((unitId) => ({ unitId, hp: 0 })) },
  } };
  await pool.query(`INSERT INTO battles (id,user_id,state,status,mode,updated_at)
    SELECT gen_random_uuid(),$1,$2,'victory','quick','2026-11-26T12:00:00Z' FROM generate_series(1,$3::int)`, [userId, JSON.stringify(state), count]);
}
async function reveal(userId: string) {
  await pool.query(`UPDATE player_progress SET data=jsonb_set(data,'{completedEncounters}','["path-1-encounter-7"]') WHERE user_id=$1`, [userId]);
  await pool.query(`INSERT INTO battles (id,user_id,encounter_id,state,status,mode,updated_at)
    VALUES ($1,$2,'path-1-encounter-7','{"teams":{"player":{"units":[]},"enemy":{"units":[]}},"turn":1}','victory','campaign','2026-11-26T11:00:00Z')`, [randomUUID(), userId]);
}

it('migra as 27 missões no banco real, preservando Premium e corrigindo o nome sem mover assets', async () => {
  const catalog = await cms.catalog();
  for (const expected of missionBoardRules) {
    expect(catalog.characters.find((c) => c.id === expected.unitId)?.unlockRule?.requirements, expected.unitId).toEqual(expected.requirements);
  }
  for (const id of ['rival-b-final-mode', 'legendary-beast-premium']) {
    expect(catalog.characters.find((c) => c.id === id)).toMatchObject({ unlock: { kind: 'premium' }, priceUsd: 9.9,
      unlockRule: { availableAfterEncounterId: 'path-1-encounter-7' } });
  }
  expect(catalog.characters.find((c) => c.id === 'protagonist-main-transformed')).toMatchObject({ name: 'Ravi Berzerk', portrait: '/media/characters/ravi-berserk-face.png' });
});

it('mantém a missão Premium travada antes da batalha 7 e concede Exal final pelas quatro metas', async () => {
  const user = await player();
  await win(user.id, ['protagonist-main-transformed'], ['exal-de-grimoria-ii'], true, 30);
  await win(user.id, ['road-raider-1-base'], ['rival-b-base'], true, 15);
  await win(user.id, ['road-raider-1-base'], ['protagonist-main-base'], true, 5);
  expect((await game.getCharacterUnlocks(user.id)).characters.find((c) => c.id === 'rival-b-final-mode')).toMatchObject({ kind: 'battle-wins', campaignAvailable: false, priceUsd: 9.9 });
  expect((await auth.getProgress(user.id))?.unlockedUnitIds).not.toContain('rival-b-final-mode');
  await reveal(user.id);
  expect((await game.getCharacterUnlocks(user.id)).characters.find((c) => c.id === 'rival-b-final-mode')).toMatchObject({ requirements: [
    { current: 50, target: 50 }, { current: 30, target: 30 }, { current: 30, target: 30 }, { current: 15, target: 15 },
  ] });
  expect((await auth.getProgress(user.id))?.unlockedUnitIds).toContain('rival-b-final-mode');
  await expect(game.setTeamSlot(user.id, 0, 'rival-b-final-mode')).resolves.toContain('rival-b-final-mode');
});

it('preserva vitórias sem mortes na compactação e não aceita mortos ressuscitados ou histórico desconhecido', async () => {
  const user = await player(); await reveal(user.id);
  await win(user.id, ['rival-a-base'], ['protagonist-main-base'], true, 20);
  await win(user.id, ['guardian-healer-male-base'], ['protagonist-main-base'], true, 20);
  await win(user.id, ['guardian-healer-female-base'], ['protagonist-main-base'], false, 10);
  await win(user.id, ['guerreiros-habilidosos-a'], ['protagonist-main-base'], undefined, 30);
  await win(user.id, ['road-raider-1-base'], ['protagonist-main-base'], undefined, 20);
  const read = async () => (await game.getCharacterUnlocks(user.id)).characters.find((c) => c.id === 'legendary-beast-premium');
  expect(await read()).toMatchObject({ kind: 'battle-wins', requirements: [
    { current: 100 }, { current: 40 }, { current: 20 }, { current: 30 }, { current: 30 },
  ] });
  for (let remaining = 1; remaining; remaining = await compactCompletedBattles(pool, new Date('2027-01-01'))) { /* Drain bounded compaction batches. */ }
  expect(await read()).toMatchObject({ requirements: [{ current: 100 }, { current: 40 }, { current: 20 }, { current: 30 }, { current: 30 }] });
  expect((await auth.getProgress(user.id))?.unlockedUnitIds).not.toContain('legendary-beast-premium');
  await win(user.id, ['rival-a-base'], ['protagonist-main-base'], true, 10);
  expect((await auth.getProgress(user.id))?.unlockedUnitIds).toContain('legendary-beast-premium');
});

it('reaplica somente o novo quadro sem revogar desbloqueios, apagar metadados ou futuras edições do CMS', async () => {
  const user = await player();
  await pool.query(`UPDATE player_progress SET data=jsonb_set(data,'{unlockedUnitIds}',data->'unlockedUnitIds'||'["rival-b-final-mode"]') WHERE user_id=$1`, [user.id]);
  const raider = (await cms.catalog()).characters.find((c) => c.id === 'road-raider-1-base')!;
  await cms.save('characters', { ...raider, maxHp: 180, unlockRule: { ...raider.unlockRule!, availableAfterEncounterId: 'path-1-encounter-2' } }, false);
  await pool.query("UPDATE units SET unlock_rule=unlock_rule||'{\"editorNote\":\"Preservar autoria\"}'::jsonb WHERE id='road-raider-1-base'");
  await pool.query("DELETE FROM schema_migrations WHERE name='056_new_mission_board.sql'");
  await migrate(pool); await seedDatabase(pool);
  expect((await cms.catalog()).characters.find((c) => c.id === raider.id)).toMatchObject({ maxHp: 180, unlockRule: { availableAfterEncounterId: 'path-1-encounter-2' } });
  expect((await pool.query("SELECT unlock_rule->>'editorNote' AS note FROM units WHERE id='road-raider-1-base'")).rows[0].note).toBe('Preservar autoria');
  expect((await auth.getProgress(user.id))?.unlockedUnitIds).toContain('rival-b-final-mode');
  const premium = (await cms.catalog()).characters.find((c) => c.id === 'legendary-beast-premium')!;
  await cms.save('characters', { ...premium, priceUsd: 12.5, unlockRule: { ...premium.unlockRule!, requirements: [
    { kind: 'battle-wins', mode: 'quick', target: 7, requireNoDeaths: true, description: 'Vença 7 sem mortes.' },
  ] } }, false);
  await migrate(pool); await seedDatabase(pool);
  expect((await cms.catalog()).characters.find((c) => c.id === premium.id)).toMatchObject({ priceUsd: 12.5, unlockRule: { requirements: [{ target: 7, requireNoDeaths: true }] } });
});
