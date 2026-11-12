import type { CharacterUnlockData, CharacterUnlockProgress } from '../contracts.js';
import type { UnitDefinition } from '../content/units.js';
import { battleUnlockRules, premiumUnitPrices, type BattleUnlockRule, type UnlockBattleMode } from '../content/unlocks.js';

export interface BattleVictory {
  readonly mode: UnlockBattleMode;
  readonly playerUnitIds: readonly string[];
  readonly enemyUnitIds: readonly string[];
  readonly completedAt?: string;
}

/** Cada registro representa uma batalha vencida, independentemente do número de turnos ou de alvos repetidos. */
export function characterUnlockProgress(units: readonly Pick<UnitDefinition, 'id' | 'name' | 'portrait'>[],
  unlockedUnitIds: readonly string[], victories: readonly BattleVictory[],
  resetAtByUnitId: Readonly<Record<string, string>> = {}, campaignOpponentUnitIds?: readonly string[],
  completedEncounterIds: readonly string[] = [],
  encounterCompletedAtByEncounterId: Readonly<Record<string, string>> = {},
  configuration: { rules: readonly BattleUnlockRule[]; prices: Readonly<Record<string, number>> } = { rules: battleUnlockRules, prices: premiumUnitPrices }): CharacterUnlockData {
  const unlocked = new Set(unlockedUnitIds);
  const completedEncounters = new Set(completedEncounterIds);
  const opponents = campaignOpponentUnitIds ? new Set(campaignOpponentUnitIds) : null;
  const characters: CharacterUnlockProgress[] = [];
  for (const unit of units) {
    const campaignAvailable = unlocked.has(unit.id) || configuration.prices[unit.id] !== undefined || opponents === null || opponents.has(unit.id);
    const rule = configuration.rules.find((entry) => entry.unitId === unit.id);
    if (rule) {
      const resetAt = resetAtByUnitId[unit.id];
      const revealedAt = rule.availableFromStart ? undefined : (rule.availableAfterEncounterId ? [rule.availableAfterEncounterId]
        : rule.requirements.flatMap((requirement) => requirement.kind === 'encounter' ? [requirement.encounterId] : []))
        .map((encounterId) => encounterCompletedAtByEncounterId[encounterId])
        .filter((completedAt): completedAt is string => !!completedAt)
        .reduce<string | undefined>((earliest, completedAt) => !earliest || Date.parse(completedAt) < Date.parse(earliest) ? completedAt : earliest, undefined);
      const cutoff = [resetAt, revealedAt].filter((value): value is string => !!value)
        .reduce<string | undefined>((latest, value) => !latest || Date.parse(value) > Date.parse(latest) ? value : latest, undefined);
      const missionVictories = !campaignAvailable ? [] : cutoff ? victories.filter((victory) => victory.completedAt
        && Date.parse(victory.completedAt) > Date.parse(cutoff)) : victories;
      characters.push({ id: unit.id, name: unit.name, portrait: unit.portrait, unlocked: unlocked.has(unit.id), campaignAvailable, kind: 'battle-wins',
        requirements: rule.requirements.map((requirement) => ({
          description: requirement.description,
          target: requirement.target,
          current: requirement.kind === 'encounter'
            ? (completedEncounters.has(requirement.encounterId) ? 1 : 0)
            : Math.min(requirement.target, missionVictories.filter((victory) => victory.mode === requirement.mode
              && (!requirement.opponentUnitIds || requirement.opponentUnitIds.some((id) => victory.enemyUnitIds.includes(id)))
              && (!requirement.requiredPlayerUnitIds || requirement.requiredPlayerUnitIds.some((id) => victory.playerUnitIds.includes(id)))).length),
        })),
      });
    } else if (configuration.prices[unit.id] !== undefined) {
      characters.push({ id: unit.id, name: unit.name, portrait: unit.portrait, unlocked: unlocked.has(unit.id), campaignAvailable,
        kind: 'premium', priceUsd: configuration.prices[unit.id] });
    }
  }
  return { characters };
}
