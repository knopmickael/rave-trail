import type { Pool, PoolClient } from 'pg';
import type { GameCatalog, PlayerProgress, TeamSlots } from '@game/contracts.js';
import type { UnitDefinition } from '@game/content/units.js';
import type { CampaignOption } from '@game/content/campaigns.js';
import { GameError, type GameRepository } from '../game/repository.js';
import { readCharacterUnlocks } from './character-unlocks.js';

export async function readTeam(client: Pool | PoolClient, userId: string): Promise<TeamSlots> {
  const result = await client.query<{ slot_index: number; unit_id: string | null }>('SELECT slot_index, unit_id FROM player_team_slots WHERE user_id = $1 ORDER BY slot_index', [userId]);
  const team: TeamSlots = [null, null, null];
  for (const row of result.rows) team[row.slot_index] = row.unit_id;
  return team;
}

export class PostgresGameRepository implements GameRepository {
  constructor(private readonly pool: Pool) {}

  async getCharacterUnlocks(userId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const progress = await client.query<{ data: PlayerProgress }>(
        'SELECT data FROM player_progress WHERE user_id = $1', [userId]);
      if (!progress.rows[0]) throw new GameError(404, 'Progresso não encontrado.');
      const data = await readCharacterUnlocks(client, userId, progress.rows[0].data);
      await client.query('COMMIT');
      return data;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async getCampaigns(userId: string): Promise<CampaignOption[]> {
    const result = await this.pool.query<CampaignOption>(`SELECT c.id, c.chapter_number AS "chapterNumber", c.title, c.description,
      c.background_path AS background, c.map_background_path AS "mapBackground", c.prerequisite_encounter_id AS "prerequisiteEncounterId", c.sort_order AS "sortOrder", c.released,
      (c.released AND CASE WHEN c.prerequisite_encounter_id IS NOT NULL THEN COALESCE((p.data->'completedEncounters') ? c.prerequisite_encounter_id, false)
        ELSE true END) AS available
      FROM campaigns c JOIN player_progress p ON p.user_id = $1 ORDER BY c.sort_order, c.chapter_number`, [userId]);
    return result.rows;
  }

  async getCatalog(client: Pool | PoolClient = this.pool): Promise<GameCatalog> {
    const characters = await client.query<GameCatalog['characters'][number]>('SELECT id, name FROM narrative_characters ORDER BY id');
    const abilities = await client.query<GameCatalog['abilities'][number]>('SELECT id, name, description, energy_cost AS "energyCost", target, effects, icon_path AS icon FROM abilities ORDER BY id');
    const units = await client.query<UnitDefinition>(`SELECT u.id, u.character_id AS "characterId", u.name, u.version, u.description,
        u.max_hp AS "maxHp", u.portrait_path AS portrait, u.illustration_path AS illustration,
        u.unlock_condition AS unlock, u.roster_order AS "rosterOrder",
        array_agg(ua.ability_id ORDER BY ua.slot_index) AS "abilityIds"
        FROM units u JOIN unit_abilities ua ON ua.unit_id = u.id GROUP BY u.id ORDER BY u.roster_order NULLS LAST, u.id`);
    if (!units.rowCount || units.rows.some((unit) => unit.abilityIds.length !== 4)) {
      throw new GameError(503, 'Catálogo indisponível. Aplique as migrações e o seed do banco.');
    }
    return { characters: characters.rows, abilities: abilities.rows, units: units.rows };
  }

  async setTeamSlot(userId: string, slot: number, unitId: string | null): Promise<TeamSlots> {
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new GameError(400, 'Slot inválido.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const progress = await client.query<{ data: { unlockedUnitIds: string[] } }>('SELECT data FROM player_progress WHERE user_id = $1 FOR UPDATE', [userId]);
      if (!progress.rows[0]) throw new GameError(404, 'Progresso não encontrado.');
      if (unitId !== null) {
        const unit = await client.query('SELECT 1 FROM units WHERE id = $1', [unitId]);
        if (!unit.rowCount) throw new GameError(400, 'Personagem inválido para a equipe.');
        if (!progress.rows[0].data.unlockedUnitIds.includes(unitId)) throw new GameError(403, 'Este personagem ainda está bloqueado.');
        // Mover uma unidade já escalada, sem duplicá-la em dois slots.
        await client.query('UPDATE player_team_slots SET unit_id = NULL WHERE user_id = $1 AND unit_id = $2', [userId, unitId]);
      }
      await client.query(`INSERT INTO player_team_slots (user_id, slot_index, unit_id) VALUES ($1,$2,$3)
        ON CONFLICT (user_id, slot_index) DO UPDATE SET unit_id = EXCLUDED.unit_id`, [userId, slot, unitId]);
      await client.query('UPDATE player_progress SET revision = revision + 1, updated_at = now() WHERE user_id = $1', [userId]);
      const team = await readTeam(client, userId);
      await client.query('COMMIT');
      return team;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
