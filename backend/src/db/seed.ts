import type { Pool, PoolClient } from 'pg';
import { abilities } from '@game/content/abilities.js';
import { narrativeCharacters, STARTER_UNIT_IDS, units } from '@game/content/units.js';
import { campaigns } from '@game/content/campaigns.js';
import { encounters } from '@game/content/encounters.js';
import { synchronizeCharacterUnlocks } from './character-unlocks.js';
import type { PlayerProgress } from '@game/contracts.js';

export async function seedCatalog(client: PoolClient): Promise<void> {
  for (const campaign of campaigns) {
    await client.query(`INSERT INTO campaigns (id, chapter_number, title, description, background_path, sort_order, released)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title, description = EXCLUDED.description, background_path = EXCLUDED.background_path`,
    [campaign.id, campaign.chapterNumber, campaign.title, campaign.description, campaign.background, campaign.sortOrder, campaign.released]);
  }
  for (const character of Object.values(narrativeCharacters)) {
    await client.query('INSERT INTO narrative_characters (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name', [character.id, character.name]);
  }
  for (const ability of Object.values(abilities)) {
    // Reexecução atualiza apresentação, mas não reescreve custos/efeitos aprovados.
    await client.query(`INSERT INTO abilities (id, name, description, energy_cost, target, effects, icon_path)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, description = EXCLUDED.description, icon_path = EXCLUDED.icon_path`,
    [ability.id, ability.name, ability.description, ability.energyCost, ability.target, JSON.stringify(ability.effects), ability.icon]);
  }
  // Libera somente as posições do catálogo gerenciado antes de reordená-lo.
  // A transação do seed impede estados intermediários visíveis e conflitos UNIQUE em trocas de posição.
  await client.query('UPDATE units SET roster_order = NULL WHERE id = ANY($1::text[])', [units.map((unit) => unit.id)]);
  for (const unit of units) {
    await client.query(`INSERT INTO units (id, character_id, name, version, description, max_hp, portrait_path, illustration_path, unlock_condition, provisional, roster_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, version = EXCLUDED.version, description = EXCLUDED.description,
      portrait_path = EXCLUDED.portrait_path, illustration_path = EXCLUDED.illustration_path, roster_order = EXCLUDED.roster_order,
      unlock_condition = EXCLUDED.unlock_condition`,
    [unit.id, unit.characterId, unit.name, unit.version, unit.description, unit.maxHp, unit.portrait, unit.illustration, JSON.stringify(unit.unlock), !!unit.provisional, unit.rosterOrder]);
    for (const [slot, abilityId] of unit.abilityIds.entries()) {
      await client.query('INSERT INTO unit_abilities (unit_id, slot_index, ability_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [unit.id, slot, abilityId]);
    }
  }
  for (const encounter of encounters) {
    await client.query(`INSERT INTO encounters (id, campaign_id, position, title, story, map_x, map_y, provisional)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title,
      story = EXCLUDED.story, map_x = EXCLUDED.map_x, map_y = EXCLUDED.map_y, provisional = EXCLUDED.provisional`,
    [encounter.id, encounter.campaignId, encounter.position, encounter.title, encounter.story, encounter.mapX, encounter.mapY, encounter.provisional]);
    await client.query('DELETE FROM encounter_enemies WHERE encounter_id = $1', [encounter.id]);
    for (const [slot, unitId] of encounter.enemyUnitIds.entries()) {
      await client.query('INSERT INTO encounter_enemies (encounter_id, slot_index, unit_id) VALUES ($1,$2,$3)', [encounter.id, slot, unitId]);
    }
    for (const unitId of encounter.rewardUnitIds) {
      await client.query('INSERT INTO encounter_rewards (encounter_id, unit_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [encounter.id, unitId]);
    }
  }
}

export async function seedDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(72583619)');
    await seedCatalog(client);
    const legacy = await client.query<{ user_id: string; data: { selectedTeam: (string | null)[] } }>(
      "SELECT user_id, data FROM player_progress WHERE data ? 'selectedTeam' FOR UPDATE",
    );
    for (const row of legacy.rows) {
      // A equipe automática do protótipo vira vazia; configurações personalizadas são preservadas.
      const previous = row.data.selectedTeam;
      const automatic = JSON.stringify(previous) === JSON.stringify(STARTER_UNIT_IDS);
      if (!automatic && Array.isArray(previous)) {
        for (let slot = 0; slot < 3; slot++) {
          const id = previous[slot];
          if (typeof id === 'string' && units.some((unit) => unit.id === id)) {
            await client.query('UPDATE player_team_slots SET unit_id = $3 WHERE user_id = $1 AND slot_index = $2', [row.user_id, slot, id]);
          }
        }
      }
      await client.query("UPDATE player_progress SET data = data - 'selectedTeam' WHERE user_id = $1", [row.user_id]);
    }
    const winners = await client.query<{ user_id: string; data: PlayerProgress }>(`SELECT p.user_id, p.data FROM player_progress p
      WHERE EXISTS (SELECT 1 FROM battles b WHERE b.user_id = p.user_id AND b.status = 'victory' AND b.mode IN ('quick', 'multiplayer'))
      FOR UPDATE`);
    for (const row of winners.rows) await synchronizeCharacterUnlocks(client, row.user_id, row.data);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
