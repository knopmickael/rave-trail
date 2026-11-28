import { SECOND_CAMPAIGN_UNIT_IDS } from './second-campaign.js';
import { encounters } from './encounters.js';

export type UnlockBattleMode = 'quick' | 'multiplayer';
export interface BattleWinsUnlockRequirement {
  readonly kind: 'battle-wins';
  readonly opponentUnitIds?: readonly string[];
  readonly mode: UnlockBattleMode;
  readonly target: number;
  readonly description: string;
  readonly requiredPlayerUnitIds?: readonly string[];
  readonly requireNoDeaths?: boolean;
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
export const MISSION_GROUPS = {
  raiders: ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base', 'saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii'],
  pontes: ['guardian-healer-male-base', 'guardian-healer-female-base', 'passage-guardian-base'],
  grimoria: ['rival-a-base', 'rival-b-base', 'rival-female-base', 'jung-de-grimoria-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii', 'rival-b-final-mode'],
  espinea: ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c'],
} as const;

const wins = (opponents: string | readonly string[] | undefined, target: number, description: string,
  mode: UnlockBattleMode = 'quick', requiredPlayerUnitIds?: readonly string[]): BattleWinsUnlockRequirement =>
  ({ kind: 'battle-wins', opponentUnitIds: typeof opponents === 'string' ? [opponents] : opponents, target, description, mode,
    ...(requiredPlayerUnitIds ? { requiredPlayerUnitIds } : {}) });
const rule = (unitId: string, requirements: readonly UnlockRequirement[],
  options: Pick<BattleUnlockRule, 'availableAfterEncounterId' | 'availableFromStart'> = {}): BattleUnlockRule => {
  const gate = options.availableFromStart ? undefined : options.availableAfterEncounterId
    ?? requirements.find((r) => r.kind === 'encounter')?.encounterId
    ?? encounters.find((e) => e.enemyUnitIds.includes(unitId))?.id;
  return { unitId, description: requirements.map((requirement) => requirement.description).join(' '), requirements,
    ...(gate ? { availableAfterEncounterId: gate } : { availableFromStart: true }) };
};
const single = (unitId: string, requirement: UnlockRequirement): BattleUnlockRule => rule(unitId, [requirement]);

const quickWins = (target: number) => wins(undefined, target, `Vença ${target} partidas no modo Batalha rápida.`);
const defeat = (opponentUnitId: string, target: number, name: string) =>
  wins(opponentUnitId, target, `Derrote ${name} na Batalha rápida ${target} ${target === 1 ? 'vez' : 'vezes'}.`);
const using = (target: number, name: string, players: readonly string[], opponent?: { id: string; name: string }) =>
  wins(opponent?.id, target, opponent
    ? `Derrote ${opponent.name} na Batalha rápida ${target} ${target === 1 ? 'vez' : 'vezes'} utilizando ${name}.`
    : `Vença ${target} partidas no modo Batalha rápida utilizando ${name}.`, 'quick', players);

export const missionBoardRules: readonly BattleUnlockRule[] = [
  ...([
    ['road-raider-1-base', 'Saqueador da estrada I'], ['road-raider-2-base', 'Saqueador da estrada II'], ['road-raider-3-base', 'Saqueadora da estrada'],
  ] as const).map(([id, name]) => rule(id, [quickWins(3), defeat(id, 1, name)])),
  ...([
    ['rival-a-base', 'Jung de Grimória', 'protagonist-main-base', 'Ravi de Berdal'],
    ['rival-b-base', 'Exal de Grimória', 'protagonist-secondary-base', 'Doko de Berdal'],
    ['rival-female-base', 'Monnica de Grimória', 'protagonist-female-base', 'Anna de Berdal'],
  ] as const).map(([id, name, player, playerName]) => rule(id, [quickWins(5), defeat(id, 3, name), using(1, playerName, [player], { id, name })])),
  ...([
    ['guardian-healer-male-base', 'Curandeiro de Pontes'], ['guardian-healer-female-base', 'Curandeira de Pontes'],
  ] as const).map(([id, name]) => rule(id, [quickWins(5), defeat(id, 3, name), using(1, 'Saqueadores da estrada', MISSION_GROUPS.raiders, { id, name })])),
  rule('passage-guardian-base', [quickWins(10), defeat('passage-guardian-base', 5, 'Drak de Pontes'),
    using(3, 'Saqueadores da estrada', MISSION_GROUPS.raiders, { id: 'passage-guardian-base', name: 'Drak de Pontes' })]),
  ...([
    ['saqueador-da-estrada-iii', 'Saqueador da estrada III'], ['saqueador-da-estrada-iv', 'Saqueador da estrada IV'], ['saqueadora-da-estrada-ii', 'Saqueadora da estrada II'],
  ] as const).map(([id, name]) => rule(id, [quickWins(10), defeat(id, 5, name)], { availableAfterEncounterId: 'path-1-encounter-4' })),
  ...([
    ['guerreiros-habilidosos-a', 'Trinity de Espinea'], ['guerreiros-habilidosos-b', 'Vlade de Espinea'], ['guerreiros-habilidosos-c', 'Passago de Espinea'],
  ] as const).map(([id, name]) => rule(id, [quickWins(10), defeat(id, 5, name), using(3, 'personagens de Pontes', MISSION_GROUPS.pontes, { id, name })], { availableAfterEncounterId: 'path-1-encounter-5' })),
  ...([
    ['jung-de-grimoria-ii', 'Jung de Grimória II', 'rival-a-base', 'Jung de Grimória'],
    ['exal-de-grimoria-ii', 'Exal de Grimória II', 'rival-b-base', 'Exal de Grimória'],
    ['monnica-de-grimoria-ii', 'Monnica de Grimória II', 'rival-female-base', 'Monnica de Grimória'],
  ] as const).map(([id, name, original, originalName]) => rule(id, [quickWins(15), defeat(id, 10, name), using(5, originalName, [original])], { availableAfterEncounterId: 'path-1-encounter-6' })),
  rule('protagonist-main-transformed', [
    quickWins(25), defeat('jung-de-grimoria-ii', 15, 'Jung de Grimória II'), defeat('exal-de-grimoria-ii', 15, 'Exal de Grimória II'),
    defeat('monnica-de-grimoria-ii', 15, 'Monnica de Grimória II'), using(10, 'Ravi de Berdal', ['protagonist-main-base']),
  ], { availableAfterEncounterId: 'path-1-encounter-7' }),
  rule('rival-b-final-mode', [quickWins(50), defeat('protagonist-main-transformed', 30, 'Ravi Berzerk'),
    using(30, 'Exal de Grimória II', ['exal-de-grimoria-ii']), using(15, 'Exal de Grimória', ['rival-b-base'])], { availableAfterEncounterId: 'path-1-encounter-7' }),
  rule('legendary-beast-premium', [quickWins(100),
    { ...quickWins(50), requireNoDeaths: true, description: 'Vença 50 partidas no modo Batalha rápida sem que nenhum membro da equipe morra.' },
    ...(['grimoria', 'pontes', 'espinea'] as const).map((group) => wins(MISSION_GROUPS[group], 30,
      `Vença 30 partidas no modo Batalha rápida contra alguém de ${{ grimoria: 'Grimória', pontes: 'Pontes', espinea: 'Espinea' }[group]}.`)),
  ], { availableAfterEncounterId: 'path-1-encounter-7' }),
  ...([
    ['general-abel', 'General Abel', 10, 5], ['guardia-da-fronteira', 'Guardiã da fronteira', 10, 5], ['samurai-erlang', 'Samurai Erlang', 10, 5],
    ['sabio-do-castelo', 'Sábio do castelo', 15, 10], ['emissario-do-castelo', 'Emissário do castelo', 15, 10], ['grande-rei-osiris', 'Grande rei Osiris', 25, 15],
  ] as const).map(([id, name, total, defeated]) => rule(id, [quickWins(total), defeat(id, defeated, name)])),
];

export const battleUnlockRules: readonly BattleUnlockRule[] = [
  rule(KALIS_UNIT_ID, [quickWins(3)], { availableFromStart: true }),
  rule(RIDAN_UNIT_ID, [quickWins(3)], { availableFromStart: true }),
  ...SECOND_CAMPAIGN_UNIT_IDS.filter((id) => id !== 'maga-artemis' && !missionBoardRules.some((rule) => rule.unitId === id))
    .map((id) => single(id, wins(undefined, 100, 'Vença 100 batalhas na Batalha rápida.'))),
  ...missionBoardRules,
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
