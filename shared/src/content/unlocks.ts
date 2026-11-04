import { SECOND_CAMPAIGN_UNIT_IDS } from './second-campaign.js';

export type UnlockBattleMode = 'quick' | 'multiplayer';
export interface BattleWinsUnlockRequirement {
  readonly kind: 'battle-wins';
  readonly opponentUnitIds?: readonly string[];
  readonly mode: UnlockBattleMode;
  readonly target: number;
  readonly description: string;
  readonly requiredPlayerUnitIds?: readonly string[];
}
export interface EncounterUnlockRequirement {
  readonly kind: 'encounter';
  readonly encounterId: string;
  readonly target: 1;
  readonly description: string;
}
export type UnlockRequirement = BattleWinsUnlockRequirement | EncounterUnlockRequirement;
export interface BattleUnlockRule {
  readonly unitId: string;
  readonly description: string;
  readonly requirements: readonly UnlockRequirement[];
  readonly availableAfterEncounterId?: string;
  readonly availableFromStart?: boolean;
}

export const KALIS_UNIT_ID = 'capitao-da-guarda-kalis-base';
export const RIDAN_UNIT_ID = 'capitao-da-guarda-ridan-base';
const raiderUnits = ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'];

const wins = (opponents: string | readonly string[] | undefined, target: number, description: string,
  mode: UnlockBattleMode = 'quick', requiredPlayerUnitIds?: readonly string[]): BattleWinsUnlockRequirement =>
  ({ kind: 'battle-wins', opponentUnitIds: typeof opponents === 'string' ? [opponents] : opponents, target, description, mode,
    ...(requiredPlayerUnitIds ? { requiredPlayerUnitIds } : {}) });
const encounter = (encounterId: string, battle: number): EncounterUnlockRequirement =>
  ({ kind: 'encounter', encounterId, target: 1, description: `Finalize a batalha ${battle} da campanha 1.` });
const rule = (unitId: string, requirements: readonly UnlockRequirement[],
  options: Pick<BattleUnlockRule, 'availableAfterEncounterId' | 'availableFromStart'> = {}): BattleUnlockRule =>
  ({ unitId, description: requirements.map((requirement) => requirement.description).join(' '), requirements, ...options });
const single = (unitId: string, requirement: UnlockRequirement): BattleUnlockRule => rule(unitId, [requirement]);

const quickWins = (target: number) => wins(undefined, target, `Vença ${target} partidas no modo Batalha rápida.`);
const defeat = (opponentUnitId: string, target: number, name: string) =>
  wins(opponentUnitId, target, `Derrote ${name} na Batalha rápida ${target} vezes.`);

export const battleUnlockRules: readonly BattleUnlockRule[] = [
  rule(KALIS_UNIT_ID, [quickWins(3)], { availableFromStart: true }),
  rule(RIDAN_UNIT_ID, [quickWins(3)], { availableFromStart: true }),
  ...SECOND_CAMPAIGN_UNIT_IDS.filter((unitId) => unitId !== 'maga-artemis').map((unitId) => ({
    ...single(unitId, wins(undefined, 100, 'Vença 100 batalhas na Batalha rápida.')),
  })),
  rule('road-raider-1-base', [
    encounter('path-1-encounter-1', 1),
    quickWins(5),
    defeat('road-raider-1-base', 3, 'Saqueador da estrada I'),
  ]),
  rule('road-raider-2-base', [
    encounter('path-1-encounter-1', 1),
    quickWins(5),
    defeat('road-raider-2-base', 3, 'Saqueador da estrada II'),
  ]),
  rule('road-raider-3-base', [
    encounter('path-1-encounter-1', 1),
    quickWins(5),
    defeat('road-raider-3-base', 3, 'Saqueadora da estrada'),
  ]),
  rule('rival-a-base', [
    encounter('path-1-encounter-2', 2),
    quickWins(10),
    defeat('rival-a-base', 5, 'Jung de Grimória'),
    wins('rival-a-base', 3, 'Derrote Jung de Grimória na Batalha rápida 3 vezes utilizando Ravi de Berdal.', 'quick', ['protagonist-main-base']),
  ]),
  rule('jung-de-grimoria-ii', [
    encounter('path-1-encounter-6', 6),
    quickWins(25),
    defeat('rival-a-base', 15, 'Jung de Grimória'),
    wins('rival-a-base', 10, 'Derrote Jung de Grimória na Batalha rápida 10 vezes utilizando Ravi de Berdal.', 'quick', ['protagonist-main-base']),
  ]),
  rule('rival-b-base', [
    encounter('path-1-encounter-2', 2),
    quickWins(10),
    defeat('rival-b-base', 5, 'Exal de Grimória'),
  ]),
  rule('rival-female-base', [
    encounter('path-1-encounter-2', 2),
    quickWins(10),
    defeat('rival-female-base', 5, 'Monnica de Grimória'),
  ]),
  rule('guardian-healer-male-base', [
    encounter('path-1-encounter-3', 3),
    quickWins(10),
    defeat('guardian-healer-male-base', 5, 'Curandeiro de Pontes'),
  ]),
  rule('guardian-healer-female-base', [
    encounter('path-1-encounter-3', 3),
    quickWins(10),
    defeat('guardian-healer-female-base', 5, 'Curandeira de Pontes'),
  ]),
  rule('passage-guardian-base', [
    encounter('path-1-encounter-3', 3),
    quickWins(20),
    defeat('passage-guardian-base', 10, 'Drak de Pontes'),
    wins('passage-guardian-base', 5, 'Derrote Drak de Pontes na Batalha rápida 5 vezes utilizando Saqueadores da estrada.', 'quick', raiderUnits),
  ]),
  rule('guerreiros-habilidosos-a', [
    encounter('path-1-encounter-4', 4),
    quickWins(15),
    defeat('guerreiros-habilidosos-a', 15, 'Trinity de Espinea'),
  ]),
  rule('guerreiros-habilidosos-b', [
    encounter('path-1-encounter-4', 4),
    quickWins(15),
    defeat('guerreiros-habilidosos-b', 15, 'Vlade de Espinea'),
  ]),
  rule('guerreiros-habilidosos-c', [
    encounter('path-1-encounter-4', 4),
    quickWins(15),
    defeat('guerreiros-habilidosos-c', 15, 'Passago de Espinea'),
  ]),
  rule('protagonist-main-transformed', [
    encounter('path-1-encounter-7', 7),
    quickWins(30),
    defeat('rival-a-base', 20, 'Jung de Grimória'),
    wins('jung-de-grimoria-ii', 10, 'Derrote Jung de Grimória II na Batalha rápida 10 vezes utilizando Ravi de Berdal.', 'quick', ['protagonist-main-base']),
  ], { availableAfterEncounterId: 'path-1-encounter-7' }),
];

export const premiumUnitPrices: Readonly<Record<string, number>> = {
  'rival-b-final-mode': 9.9,
  'legendary-beast-premium': 9.9,
  'maga-artemis': 9.9,
};

export function battleUnlock(unitId: string): { readonly kind: 'battle-wins'; readonly description: string } {
  const found = battleUnlockRules.find((entry) => entry.unitId === unitId);
  if (!found) throw new Error(`Regra de desbloqueio não encontrada: ${unitId}`);
  return { kind: 'battle-wins', description: found.description };
}
