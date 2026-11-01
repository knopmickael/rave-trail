import { SECOND_CAMPAIGN_UNIT_IDS } from './second-campaign.js';

export type UnlockBattleMode = 'quick' | 'multiplayer';
export interface UnlockRequirement {
  readonly opponentUnitIds?: readonly string[];
  readonly mode: UnlockBattleMode;
  readonly target: number;
  readonly description: string;
  readonly requiredPlayerUnitIds?: readonly string[];
}
export interface BattleUnlockRule {
  readonly unitId: string;
  readonly description: string;
  readonly requirements: readonly UnlockRequirement[];
  readonly availableAfterEncounterId?: string;
}

const berdalUnits = ['protagonist-main-base', 'protagonist-secondary-base', 'protagonist-female-base', 'protagonist-main-transformed'];
const grimorianUnits = ['rival-a-base', 'jung-de-grimoria-ii', 'rival-b-base', 'rival-female-base'];
const wins = (opponents: string | readonly string[] | undefined, target: number, description: string,
  mode: UnlockBattleMode = 'quick', requiredPlayerUnitIds?: readonly string[]): UnlockRequirement =>
  ({ opponentUnitIds: typeof opponents === 'string' ? [opponents] : opponents, target, description, mode,
    ...(requiredPlayerUnitIds ? { requiredPlayerUnitIds } : {}) });
const single = (unitId: string, requirement: UnlockRequirement): BattleUnlockRule =>
  ({ unitId, description: requirement.description, requirements: [requirement] });

export const battleUnlockRules: readonly BattleUnlockRule[] = [
  ...SECOND_CAMPAIGN_UNIT_IDS.filter((unitId) => unitId !== 'maga-artemis').map((unitId) => ({
    ...single(unitId, wins(undefined, 100, 'Vença 100 batalhas na batalha rápida.')),
  })),
  single('road-raider-1-base', wins('road-raider-1-base', 5, 'Derrote Saqueador da estrada I na Batalha rápida 5 vezes.')),
  single('road-raider-2-base', wins('road-raider-2-base', 5, 'Derrote Saqueador da estrada II na Batalha rápida 5 vezes.')),
  single('road-raider-3-base', wins('road-raider-3-base', 5, 'Derrote Saqueadora da estrada na Batalha rápida 5 vezes.')),
  single('rival-a-base', wins('rival-a-base', 10, 'Derrote Jung de Grimória na Batalha rápida 10 vezes utilizando Ravi de Berdal.', 'quick', ['protagonist-main-base'])),
  single('jung-de-grimoria-ii', wins('jung-de-grimoria-ii', 25, 'Derrote Jung de Grimória II na Batalha rápida 25 vezes utilizando Ravi de Berdal.', 'quick', ['protagonist-main-base'])),
  single('rival-b-base', wins('rival-b-base', 10, 'Derrote Exal de Grimória no Multiplayer 10 vezes.', 'multiplayer')),
  single('rival-female-base', wins('rival-female-base', 10, 'Derrote Monnica de Grimória na Batalha rápida 10 vezes.')),
  single('guardian-healer-male-base', wins('guardian-healer-male-base', 10, 'Derrote Curandeiro de Pontes na Batalha rápida 10 vezes.')),
  single('guardian-healer-female-base', wins('guardian-healer-female-base', 10, 'Derrote Curandeira de Pontes na Batalha rápida 10 vezes.')),
  single('passage-guardian-base', wins('passage-guardian-base', 15, 'Derrote Drak de Pontes na Batalha rápida 15 vezes utilizando alguém de Berdal.', 'quick', berdalUnits)),
  single('guerreiros-habilidosos-a', wins(grimorianUnits, 20, 'Derrote Grimorianos na Batalha rápida 20 vezes (Jung I ou II, Exal de Grimória ou Monnica).')),
  single('guerreiros-habilidosos-b', wins(grimorianUnits, 20, 'Derrote Grimorianos na Batalha rápida 20 vezes (Jung I ou II, Exal de Grimória ou Monnica).')),
  {
    unitId: 'guerreiros-habilidosos-c',
    description: 'Derrote Grimorianos em 20 Batalhas rápidas e 10 partidas Multiplayer (Jung I ou II, Exal de Grimória ou Monnica).',
    requirements: [
      wins(grimorianUnits, 20, 'Derrote Grimorianos na Batalha rápida 20 vezes (Jung I ou II, Exal de Grimória ou Monnica).'),
      wins(grimorianUnits, 10, 'Derrote Grimorianos no Multiplayer 10 vezes (Jung I ou II, Exal de Grimória ou Monnica).', 'multiplayer'),
    ],
  },
  {
    unitId: 'protagonist-main-transformed',
    description: 'Na Batalha rápida, vença 50 partidas e derrote Jung de Grimória 15 vezes, Exal de Grimória 20 vezes e Monnica de Grimória 10 vezes.',
    requirements: [
      wins('rival-a-base', 15, 'Derrote Jung de Grimória na Batalha rápida 15 vezes.'),
      wins('rival-b-base', 20, 'Derrote Exal de Grimória na Batalha rápida 20 vezes.'),
      wins('rival-female-base', 10, 'Derrote Monnica de Grimória na Batalha rápida 10 vezes.'),
      wins(undefined, 50, 'Vença 50 batalhas rápidas.'),
    ],
  },
];

export const premiumUnitPrices: Readonly<Record<string, number>> = {
  'rival-b-final-mode': 9.9,
  'legendary-beast-premium': 9.9,
  'maga-artemis': 9.9,
};

export function battleUnlock(unitId: string): { readonly kind: 'battle-wins'; readonly description: string } {
  const rule = battleUnlockRules.find((entry) => entry.unitId === unitId);
  if (!rule) throw new Error(`Regra de desbloqueio não encontrada: ${unitId}`);
  return { kind: 'battle-wins', description: rule.description };
}
