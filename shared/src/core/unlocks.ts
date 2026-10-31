import type { CharacterUnlockData, CharacterUnlockProgress } from '../contracts.js';
import type { UnitDefinition } from '../content/units.js';
import { battleUnlockRules, premiumUnitPrices, type UnlockBattleMode } from '../content/unlocks.js';

export interface BattleVictory {
  readonly mode: UnlockBattleMode;
  readonly playerUnitIds: readonly string[];
  readonly enemyUnitIds: readonly string[];
  readonly completedAt?: string;
}

/** Cada registro representa uma batalha vencida, independentemente do número de turnos ou de alvos repetidos. */
export function characterUnlockProgress(units: readonly Pick<UnitDefinition, 'id' | 'name' | 'portrait'>[],
  unlockedUnitIds: readonly string[], victories: readonly BattleVictory[],
  resetAtByUnitId: Readonly<Record<string, string>> = {}, campaignOpponentUnitIds?: readonly string[]): CharacterUnlockData {
  const unlocked = new Set(unlockedUnitIds);
  const opponents = campaignOpponentUnitIds ? new Set(campaignOpponentUnitIds) : null;
  const characters: CharacterUnlockProgress[] = [];
  for (const unit of units) {
    const campaignAvailable = opponents === null || opponents.has(unit.id);
    const rule = battleUnlockRules.find((entry) => entry.unitId === unit.id);
    if (rule) {
      const resetAt = resetAtByUnitId[unit.id];
      const missionVictories = !campaignAvailable ? [] : resetAt ? victories.filter((victory) => victory.completedAt
        && Date.parse(victory.completedAt) > Date.parse(resetAt)) : victories;
      characters.push({ id: unit.id, name: unit.name, portrait: unit.portrait, unlocked: unlocked.has(unit.id), campaignAvailable, kind: 'battle-wins',
        requirements: rule.requirements.map((requirement) => ({
          description: requirement.description,
          target: requirement.target,
          current: Math.min(requirement.target, missionVictories.filter((victory) => victory.mode === requirement.mode
            && (!requirement.opponentUnitIds || requirement.opponentUnitIds.some((id) => victory.enemyUnitIds.includes(id)))
            && (!requirement.requiredPlayerUnitIds || requirement.requiredPlayerUnitIds.some((id) => victory.playerUnitIds.includes(id)))).length),
        })),
      });
    } else if (premiumUnitPrices[unit.id] !== undefined) {
      characters.push({ id: unit.id, name: unit.name, portrait: unit.portrait, unlocked: unlocked.has(unit.id), campaignAvailable,
        kind: 'premium', priceUsd: premiumUnitPrices[unit.id] });
    }
  }
  return { characters };
}
