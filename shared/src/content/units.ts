import type { AbilityId } from './abilities.js';
import { battleUnlock, KALIS_UNIT_ID, RIDAN_UNIT_ID } from './unlocks.js';
import { SECOND_CAMPAIGN_CHARACTERS, SECOND_CAMPAIGN_UNIT_IDS, type SecondCampaignCharacterId } from './second-campaign.js';

export const STARTER_UNIT_IDS = ['protagonist-main-base', 'protagonist-secondary-base', 'protagonist-female-base'] as const;
export const QUICK_BATTLE_ALWAYS_UNIT_IDS = [...STARTER_UNIT_IDS] as const;
export const QUICK_BATTLE_MISSION_OPPONENT_UNIT_IDS = [KALIS_UNIT_ID, RIDAN_UNIT_ID] as const;

export const ROSTER_UNIT_IDS = [
  ...QUICK_BATTLE_ALWAYS_UNIT_IDS,
  ...QUICK_BATTLE_MISSION_OPPONENT_UNIT_IDS,
  'road-raider-1-base',
  'road-raider-2-base',
  'road-raider-3-base',
  'rival-a-base',
  'rival-b-base',
  'rival-female-base',
  'guardian-healer-male-base',
  'guardian-healer-female-base',
  'passage-guardian-base',
  'guerreiros-habilidosos-a',
  'guerreiros-habilidosos-b',
  'guerreiros-habilidosos-c',
  'jung-de-grimoria-ii',
  'protagonist-main-transformed',
  'rival-b-final-mode',
  'legendary-beast-premium',
  ...SECOND_CAMPAIGN_UNIT_IDS,
] as const;

export interface NarrativeCharacter {
  readonly id: string;
  readonly name: string;
}

// Nomes de exibição aprovados. IDs de unidades e progresso permanecem estáveis.
export const narrativeCharacters = {
  ...Object.fromEntries(SECOND_CAMPAIGN_CHARACTERS.map(({ id, name }) => [id, { id, name }])) as Record<SecondCampaignCharacterId, NarrativeCharacter>,
  'protagonist-main': { id: 'protagonist-main', name: 'Ravi de Berdal' },
  'protagonist-secondary': { id: 'protagonist-secondary', name: 'Doko de Berdal' },
  'protagonist-female': { id: 'protagonist-female', name: 'Anna de Berdal' },
  'capitao-da-guarda-kalis': { id: 'capitao-da-guarda-kalis', name: 'Capitão da guarda Kalis' },
  'capitao-da-guarda-ridan': { id: 'capitao-da-guarda-ridan', name: 'Capitão da guarda Ridan' },
  'road-raider-1': { id: 'road-raider-1', name: 'Saqueador da estrada I' },
  'road-raider-2': { id: 'road-raider-2', name: 'Saqueador da estrada II' },
  'road-raider-3': { id: 'road-raider-3', name: 'Saqueadora da estrada' },
  'rival-a': { id: 'rival-a', name: 'Jung de Grimória' },
  'rival-b': { id: 'rival-b', name: 'Exal de Grimória' },
  'rival-female': { id: 'rival-female', name: 'Monnica de Grimória' },
  'passage-guardian': { id: 'passage-guardian', name: 'Drak de Pontes' },
  'guardian-healer-male': { id: 'guardian-healer-male', name: 'Curandeiro de Pontes' },
  'guardian-healer-female': { id: 'guardian-healer-female', name: 'Curandeira de Pontes' },
  'legendary-beast': { id: 'legendary-beast', name: 'Besta Lendária' },
  'guerreiros-habilidosos-a': { id: 'guerreiros-habilidosos-a', name: 'Trinity de Espinea' },
  'guerreiros-habilidosos-b': { id: 'guerreiros-habilidosos-b', name: 'Vlade de Espinea' },
  'guerreiros-habilidosos-c': { id: 'guerreiros-habilidosos-c', name: 'Passago de Espinea' },
} as const satisfies Record<string, NarrativeCharacter>;

export type CharacterId = keyof typeof narrativeCharacters;
export type UnlockCondition =
  | { readonly kind: 'starter'; readonly description: string }
  | { readonly kind: 'premium' | 'battle-wins'; readonly description: string };

export interface UnitDefinition {
  readonly id: string;
  readonly characterId: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly maxHp: number;
  readonly portrait: string;
  readonly illustration: string;
  readonly abilityIds: readonly [string, string, string, string];
  readonly unlock: UnlockCondition;
  readonly rosterOrder: number | null;
}

const common = ['simple-strike', 'guard', 'retain-energy'] as const;
const starter = { kind: 'starter', description: 'Disponível desde o início da jornada.' } as const;
const unitNameOverrides: Readonly<Record<string, string>> = {
  'jung-de-grimoria-ii': 'Jung de Grimória II',
  'protagonist-main-transformed': 'Ravi Berserk',
  'rival-b-final-mode': 'Exal - Verdadeiro poder',
};
const unitAssetOverrides: Readonly<Record<string, { portrait: string; illustration: string }>> = {
  'legendary-beast-premium': {
    portrait: '/media/characters/fera-lendaria-face.png',
    illustration: '/media/characters/fera-lendaria-body.png',
  },
};

function defineUnit(unit: Omit<UnitDefinition, 'name' | 'maxHp' | 'portrait' | 'illustration' | 'rosterOrder' | 'characterId' | 'abilityIds'>
  & { characterId: CharacterId; abilityIds: readonly [AbilityId, AbilityId, AbilityId, AbilityId] }): UnitDefinition {
  const rosterOrder = (ROSTER_UNIT_IDS as readonly string[]).indexOf(unit.id);
  const name = unitNameOverrides[unit.id] ?? narrativeCharacters[unit.characterId].name;
  const assetName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const assets = unitAssetOverrides[unit.id];
  return {
    ...unit,
    name,
    maxHp: 100,
    portrait: assets?.portrait ?? `/media/characters/${assetName}-face.png`,
    illustration: assets?.illustration ?? `/media/characters/${assetName}-body.png`,
    rosterOrder: rosterOrder < 0 ? null : rosterOrder,
  };
}

export const units: readonly UnitDefinition[] = [
  defineUnit({
    id: STARTER_UNIT_IDS[0], characterId: 'protagonist-main', version: 'Jovem da guarda',
    description: 'Jovem camponês otimista e impulsivo. Entrou na guarda para defender seu vilarejo e parte em sua primeira jornada usando técnicas físicas simples.',
    abilityIds: [...common, 'main-special'], unlock: starter,
  }),
  defineUnit({
    id: STARTER_UNIT_IDS[1], characterId: 'protagonist-secondary', version: 'Jovem da guarda',
    description: 'Reservado, disciplinado e atento aos movimentos do adversário. Encontra na estratégia uma maneira de proteger os amigos durante a missão de reconhecimento.',
    abilityIds: [...common, 'female-special'], unlock: starter,
  }),
  defineUnit({
    id: STARTER_UNIT_IDS[2], characterId: 'protagonist-female', version: 'Jovem da guarda',
    description: 'Inteligente, pragmática e corajosa. Seu talento para a defesa e o suporte mantém a equipe unida diante dos perigos das rotas comerciais.',
    abilityIds: [...common, 'secondary-special'], unlock: starter,
  }),
  defineUnit({
    id: KALIS_UNIT_ID, characterId: 'capitao-da-guarda-kalis', version: 'Capitão da guarda',
    description: 'Capitão da guarda de Berdal, aliado dos protagonistas. Combina defesa, recuperação de energia e cura para sustentar a equipe.',
    abilityIds: ['simple-strike', 'guard', 'retain-energy', 'heal'], unlock: battleUnlock(KALIS_UNIT_ID),
  }),
  defineUnit({
    id: RIDAN_UNIT_ID, characterId: 'capitao-da-guarda-ridan', version: 'Capitão da guarda',
    description: 'Capitão da guarda de Berdal, aliado dos protagonistas. Prepara os companheiros com Força interna antes de partir para o ataque.',
    abilityIds: ['simple-strike', 'guard', 'retain-energy', 'internal-strength'], unlock: battleUnlock(RIDAN_UNIT_ID),
  }),
  ...(['road-raider-1', 'road-raider-2', 'road-raider-3'] as const).map((characterId) => defineUnit({
    id: `${characterId}-base`, characterId, version: 'Saqueadores da estrada',
    description: 'Combatente encontrado na primeira estrada fora do vilarejo. Explora a insegurança das rotas comerciais para atacar viajantes.',
    abilityIds: [...common, characterId === 'road-raider-2' ? 'secondary-special' : 'strong-strike'], unlock: battleUnlock(`${characterId}-base`),
  })),
  ...(['rival-a', 'rival-b'] as const).map((characterId) => defineUnit({
    id: `${characterId}-base`, characterId, version: 'Primeiro encontro',
    description: 'Jovem mercenário de um trio rival. Sua presença nas estradas sugere uma organização por trás dos ataques à região.',
    abilityIds: [...common, characterId === 'rival-a' ? 'main-special' : 'soul-drain'], unlock: battleUnlock(`${characterId}-base`),
  })),
  defineUnit({
    id: 'jung-de-grimoria-ii', characterId: 'rival-a', version: 'Versão II',
    description: 'Segunda versão jogável de Jung de Grimória, enfrentada na fronteira das trevas. Utiliza as mesmas técnicas da versão original.',
    abilityIds: ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'quick-slash'], unlock: battleUnlock('jung-de-grimoria-ii'),
  }),
  defineUnit({
    id: 'rival-female-base', characterId: 'rival-female', version: 'Primeiro encontro',
    description: 'Integrante do trio de mercenários rivais. Apoia seus companheiros recuperando a vida dos aliados durante os confrontos.',
    abilityIds: ['simple-strike', 'guard', 'retain-energy', 'heal'], unlock: battleUnlock('rival-female-base'),
  }),
  defineUnit({
    id: 'passage-guardian-base', characterId: 'passage-guardian', version: 'Guardião',
    description: 'Um combatente experiente que controla a passagem. Combina golpes fortes e uma técnica capaz de conceder turnos adicionais à própria equipe.',
    abilityIds: ['main-special', 'fast-move', 'retain-energy', 'extra-turn'],
    unlock: battleUnlock('passage-guardian-base'),
  }),
  ...(['guardian-healer-male', 'guardian-healer-female'] as const).map((characterId) => defineUnit({
    id: `${characterId}-base`, characterId, version: 'Guardião da passagem',
    description: 'Integrante da equipe do guardião. Alterna defesa e recuperação de vida para sustentar os aliados na batalha pela passagem.',
    abilityIds: ['simple-strike', 'female-special', 'retain-energy', 'heal'], unlock: battleUnlock(`${characterId}-base`),
  })),
  ...(['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c'] as const).map((characterId) => defineUnit({
    id: characterId, characterId, version: 'Após a passagem',
    description: 'Integrante do trio de guerreiros habilidosos encontrado após o confronto com Drak de Pontes.',
    abilityIds: characterId === 'guerreiros-habilidosos-a' ? ['main-special', 'fast-move', 'retain-energy', 'secondary-special']
      : characterId === 'guerreiros-habilidosos-b' ? ['main-special', 'fast-move', 'retain-energy', 'female-special']
        : ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'secondary-special'], unlock: battleUnlock(characterId),
  })),
  defineUnit({
    id: 'rival-b-final-mode', characterId: 'rival-b', version: 'Verdadeiro poder',
    description: 'O verdadeiro poder de Exal de Grimória, o vilão do confronto final da primeira jornada.',
    abilityIds: ['dark-vortex', 'fast-move', 'retain-energy-plus', 'soul-drain-plus'],
    unlock: { kind: 'premium', description: 'Personagem premium: US$ 9,90.' },
  }),
  defineUnit({
    id: 'protagonist-main-transformed', characterId: 'protagonist-main', version: 'Despertar',
    description: 'O despertar de Ravi durante a jornada revela uma força que ele ainda precisa compreender e aprender a controlar.',
    abilityIds: ['simple-strike-ii', 'female-special', 'retain-energy-plus', 'fury-scream'],
    unlock: battleUnlock('protagonist-main-transformed'),
  }),
  defineUnit({
    id: 'legendary-beast-premium', characterId: 'legendary-beast', version: 'Lendária',
    description: 'Uma presença rara que sugere forças muito além das conhecidas no vilarejo.',
    abilityIds: ['heal-plus', 'female-special', 'retain-energy-plus', 'resurrection'],
    unlock: { kind: 'premium', description: 'Personagem premium: US$ 9,90.' },
  }),
  ...SECOND_CAMPAIGN_CHARACTERS.map((character) => ({
    ...defineUnit({
      id: character.id, characterId: character.id, version: 'Além das Fronteiras',
      description: character.description,
      abilityIds: [...common, 'strong-strike'],
      unlock: character.id === 'maga-artemis' ? { kind: 'premium', description: 'Personagem premium: US$ 9,90.' } : battleUnlock(character.id),
    }),
    portrait: `/media/characters/02/${character.id}-face.png`,
    illustration: `/media/characters/02/${character.id}.png`,
  })),
];

// Ordem inicial do catálogo completo; a interface também aceita registros adicionais do banco.
export const rosterUnits: readonly UnitDefinition[] = ROSTER_UNIT_IDS.map((id) => {
  const unit = units.find((entry) => entry.id === id);
  if (!unit) throw new Error(`Unidade da lista não encontrada: ${id}`);
  return unit;
});

export function getUnitName(unit: UnitDefinition): string {
  return unit.name;
}
