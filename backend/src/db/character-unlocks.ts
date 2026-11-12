import type { Pool, PoolClient } from 'pg';
import type { PlayerProgress } from '@game/contracts.js';
import type { UnitDefinition } from '@game/content/units.js';
import { characterUnlockProgress, type BattleVictory } from '@game/core/unlocks.js';
import { battleUnlockRules, premiumUnitPrices, type BattleUnlockRule } from '@game/content/unlocks.js';

type MissionProgress = Pick<PlayerProgress, 'unlockedUnitIds' | 'completedEncounters' | 'missionProgressResets'>;

export async function readCharacterUnlocks(client: Pool | PoolClient, userId: string, progress: MissionProgress) {
  const configured = await client.query<{ id: string; unlock: UnitDefinition['unlock'] & { priceUsd?: number }; rule: BattleUnlockRule | null }>(
    'SELECT id, unlock_condition AS unlock, unlock_rule AS rule FROM units');
  const rules = configured.rows.flatMap((unit): BattleUnlockRule[] => {
    if (unit.unlock.kind === 'battle-wins') {
      const rule = unit.rule ?? battleUnlockRules.find((entry) => entry.unitId === unit.id);
      return rule ? [rule] : [];
    }
    return [];
  });
  const prices = Object.fromEntries(configured.rows.filter((unit) => unit.unlock.kind === 'premium')
    .map((unit) => [unit.id, unit.unlock.priceUsd ?? premiumUnitPrices[unit.id] ?? 9.9]));
  const available = rules.filter((rule) => rule.availableFromStart
    || (rule.availableAfterEncounterId && progress.completedEncounters.includes(rule.availableAfterEncounterId)))
    .map((rule) => rule.unitId);
  const units = await client.query<Pick<UnitDefinition, 'id' | 'name' | 'portrait'>>(
    `SELECT u.id, u.name, u.portrait_path AS portrait FROM units u ORDER BY u.roster_order NULLS LAST, u.id`);
  if (!units.rows.length) return { characters: [] };
  const victories = await client.query<BattleVictory>(`SELECT mode,
    to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "completedAt",
    ARRAY(SELECT DISTINCT fighter->>'unitId' FROM jsonb_array_elements(state #> '{teams,player,units}') AS fighter) AS "playerUnitIds",
    ARRAY(SELECT DISTINCT fighter->>'unitId' FROM jsonb_array_elements(state #> '{teams,enemy,units}') AS fighter) AS "enemyUnitIds"
    FROM battles WHERE user_id = $1 AND status = 'victory' AND mode IN ('quick', 'multiplayer')`, [userId]);
  const campaignCompletions = await client.query<{ encounterId: string; completedAt: string }>(`SELECT encounter_id AS "encounterId",
    to_char(MIN(updated_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "completedAt"
    FROM battles WHERE user_id = $1 AND status = 'victory' AND encounter_id IS NOT NULL
    GROUP BY encounter_id`, [userId]);
  const encounterCompletedAt = Object.fromEntries(campaignCompletions.rows.map((row) => [row.encounterId, row.completedAt]));
  const data = characterUnlockProgress(units.rows, progress.unlockedUnitIds, victories.rows, progress.missionProgressResets,
    available, progress.completedEncounters, encounterCompletedAt, { rules, prices });
  const gates = await client.query<{ id: string; position: number; chapter: number }>(`SELECT e.id, e.position, c.chapter_number AS chapter
    FROM encounters e JOIN campaigns c ON c.id=e.campaign_id WHERE e.id=ANY($1::text[])`, [rules.flatMap((rule) => rule.availableAfterEncounterId ? [rule.availableAfterEncounterId] : [])]);
  return { characters: data.characters.map((unit) => {
    const rule = rules.find((r) => r.unitId === unit.id);
    const gate = gates.rows.find((e) => e.id === rule?.availableAfterEncounterId);
    return unit.kind === 'battle-wins' && gate ? { ...unit, revealRequirement: `Finalize a batalha ${gate.position} da campanha ${gate.chapter}` } : unit;
  }) };
}

/** O chamador mantém player_progress bloqueado na transação que registra a vitória. */
export async function synchronizeCharacterUnlocks(client: PoolClient, userId: string, progress: MissionProgress) {
  const data = await readCharacterUnlocks(client, userId, progress);
  const earned = data.characters.filter((unit) => unit.campaignAvailable && unit.kind === 'battle-wins'
    && unit.requirements.every((requirement) => requirement.current >= requirement.target)).map((unit) => unit.id);
  const automatic = await client.query<{ id: string }>("SELECT id FROM units WHERE unlock_condition->>'kind'='starter'");
  earned.push(...automatic.rows.map((unit) => unit.id));
  const unlockedUnitIds = [...new Set([...progress.unlockedUnitIds, ...earned])];
  if (unlockedUnitIds.length !== progress.unlockedUnitIds.length) {
    await client.query(`UPDATE player_progress SET data = jsonb_set(data, '{unlockedUnitIds}', $2::jsonb),
      revision = revision + 1, updated_at = now() WHERE user_id = $1`, [userId, JSON.stringify(unlockedUnitIds)]);
  }
}
