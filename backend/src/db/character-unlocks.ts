import type { Pool, PoolClient } from 'pg';
import type { PlayerProgress } from '@game/contracts.js';
import type { UnitDefinition } from '@game/content/units.js';
import { characterUnlockProgress, type BattleVictory } from '@game/core/unlocks.js';
import { battleUnlockRules } from '@game/content/unlocks.js';

type MissionProgress = Pick<PlayerProgress, 'unlockedUnitIds' | 'completedEncounters' | 'missionProgressResets'>;

export async function readCharacterUnlocks(client: Pool | PoolClient, userId: string, progress: MissionProgress) {
  const allies = battleUnlockRules.filter((rule) => rule.availableAfterEncounterId
    && progress.completedEncounters.includes(rule.availableAfterEncounterId)).map((rule) => rule.unitId);
  const units = await client.query<Pick<UnitDefinition, 'id' | 'name' | 'portrait'> & { campaignAvailable: boolean }>(
    `SELECT u.id, u.name, u.portrait_path AS portrait,
      (u.id = ANY($2::text[]) OR EXISTS (SELECT 1 FROM encounter_enemies e WHERE e.unit_id = u.id AND e.encounter_id = ANY($1::text[]))) AS "campaignAvailable"
      FROM units u
      ORDER BY u.roster_order NULLS LAST, u.id`, [progress.completedEncounters, allies]);
  if (!units.rows.length) return { characters: [] };
  const victories = await client.query<BattleVictory>(`SELECT mode,
    to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "completedAt",
    ARRAY(SELECT DISTINCT fighter->>'unitId' FROM jsonb_array_elements(state #> '{teams,player,units}') AS fighter) AS "playerUnitIds",
    ARRAY(SELECT DISTINCT fighter->>'unitId' FROM jsonb_array_elements(state #> '{teams,enemy,units}') AS fighter) AS "enemyUnitIds"
    FROM battles WHERE user_id = $1 AND status = 'victory' AND mode IN ('quick', 'multiplayer')`, [userId]);
  return characterUnlockProgress(units.rows, progress.unlockedUnitIds, victories.rows, progress.missionProgressResets,
    units.rows.filter((unit) => unit.campaignAvailable).map((unit) => unit.id));
}

/** O chamador mantém player_progress bloqueado na transação que registra a vitória. */
export async function synchronizeCharacterUnlocks(client: PoolClient, userId: string, progress: MissionProgress) {
  const data = await readCharacterUnlocks(client, userId, progress);
  const earned = data.characters.filter((unit) => unit.campaignAvailable && unit.kind === 'battle-wins'
    && unit.requirements.every((requirement) => requirement.current >= requirement.target)).map((unit) => unit.id);
  const unlockedUnitIds = [...new Set([...progress.unlockedUnitIds, ...earned])];
  if (unlockedUnitIds.length !== progress.unlockedUnitIds.length) {
    await client.query(`UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', $2::jsonb),
      revision = revision + 1, updated_at = now() WHERE user_id = $1`, [userId, JSON.stringify(unlockedUnitIds)]);
  }
}
