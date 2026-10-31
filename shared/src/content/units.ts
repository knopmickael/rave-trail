import type { AbilityId } from './abilities.js';
import { battleUnlock } from './unlocks.js';

export const STARTER_UNIT_IDS = ['protagonist-main-base', 'protagonist-secondary-base', 'protagonist-female-base'] as const;

export const ROSTER_UNIT_IDS = [
  ...STARTER_UNIT_IDS,
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
] as const;

export interface NarrativeCharacter {
  readonly id: string;
  readonly name: string;
}

// Nomes de exibição aprovados. IDs de unidades e progresso permanecem estáveis.
export const narrativeCharacters = {
  'protagonist-main': { id: 'protagonist-main', name: 'Ravi de Berdal' },
  'protagonist-secondary': { id: 'protagonist-secondary', name: 'Doko de Berdal' },
  'protagonist-female': { id: 'protagonist-female', name: 'Anna de Berdal' },
  'road-raider-1': { id: 'road-raider-1', name: 'Saqueador da estrada I' },
  'road-raider-2': { id: 'road-raider-2', name: 'Saqueador da estrada II' },
  'road-raider-3': { id: 'road-raider-3', name: 'Saqueadora da estrada' },
  'rival-a': { id: 'rival-a', name: 'Jung de Grimória' },
  'rival-b': { id: 'rival-b', name: 'Exal de Grimória' },
  'rival-female': { id: 'rival-female', name: 'Monnica de Grimória' },
  'passage-guardian': { id: 'passage-guardian', name: 'Drak de Pontes' },
  'guardian-healer-male': { id: 'guardian-healer-male', name: 'Curandeiro de Pontes' },
  'guardian-healer-female': { id: 'guardian-healer-female', name: 'Curandeira de Pontes' },
  'legendary-beast': { id: 'legendary-beast', name: 'Fera Lendária' },
  'guerreiros-habilidosos-a': { id: 'guerreiros-habilidosos-a', name: 'Trinity de Espinea' },
  'guerreiros-habilidosos-b': { id: 'guerreiros-habilidosos-b', name: 'Vlade de Espinea' },
  'guerreiros-habilidosos-c': { id: 'guerreiros-habilidosos-c', name: 'Passago de Espinea' },
} as const satisfies Record<string, NarrativeCharacter>;

export type CharacterId = keyof typeof narrativeCharacters;
export type UnlockCondition =
  | { readonly kind: 'starter'; readonly description: string }
  | { readonly kind: 'encounter'; readonly encounterId: string; readonly description: string }
  | { readonly kind: 'unavailable' | 'premium' | 'battle-wins'; readonly description: string };

export interface UnitDefinition {
  readonly id: string;
  readonly characterId: CharacterId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly maxHp: number;
  readonly portrait: string;
  readonly illustration: string;
  readonly abilityIds: readonly [AbilityId, AbilityId, AbilityId, AbilityId];
  readonly unlock: UnlockCondition;
  readonly provisional?: boolean;
  readonly rosterOrder: number | null;
}

const common = ['simple-strike', 'guard', 'retain-energy'] as const;
const starter = { kind: 'starter', description: 'Disponível desde o início da jornada.' } as const;
const unitNameOverrides: Readonly<Record<string, string>> = {
  'jung-de-grimoria-ii': 'Jung de Grimória II',
  'protagonist-main-transformed': 'Ravi Berserk',
  'rival-b-final-mode': 'Exal - Verdadeiro poder',
};

function defineUnit(unit: Omit<UnitDefinition, 'name' | 'maxHp' | 'portrait' | 'illustration' | 'rosterOrder'>): UnitDefinition {
  const rosterOrder = (ROSTER_UNIT_IDS as readonly string[]).indexOf(unit.id);
  const name = unitNameOverrides[unit.id] ?? narrativeCharacters[unit.characterId].name;
  const assetName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return {
    ...unit,
    name,
    maxHp: 100,
    portrait: `/media/characters/${assetName}-face.png`,
    illustration: `/media/characters/${assetName}-body.png`,
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
    abilityIds: [...common, 'secondary-special'], unlock: starter,
  }),
  defineUnit({
    id: STARTER_UNIT_IDS[2], characterId: 'protagonist-female', version: 'Jovem da guarda',
    description: 'Inteligente, pragmática e corajosa. Seu talento para a defesa e o suporte mantém a equipe unida diante dos perigos das rotas comerciais.',
    abilityIds: [...common, 'female-special'], unlock: starter,
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
    abilityIds: ['simple-strike', 'female-special', 'retain-energy', 'heal'], unlock: battleUnlock('rival-female-base'),
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
    description: 'Integrante do trio de guerreiros habilidosos encontrado após o confronto com Drak de Pontes. Conjunto de habilidades temporário até a definição dos encontros.',
    abilityIds: characterId === 'guerreiros-habilidosos-a' ? ['main-special', 'fast-move', 'retain-energy', 'secondary-special']
      : characterId === 'guerreiros-habilidosos-b' ? ['main-special', 'fast-move', 'retain-energy', 'female-special']
        : ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'secondary-special'], unlock: battleUnlock(characterId), provisional: true,
  })),
  defineUnit({
    id: 'rival-b-final-mode', characterId: 'rival-b', version: 'Verdadeiro poder',
    description: 'O verdadeiro poder de Exal de Grimória, o vilão do confronto final da história. As habilidades atuais são temporárias e reutilizam técnicas existentes até a definição dos poderes finais.',
    abilityIds: ['dark-vortex', 'fast-move', 'retain-energy-plus', 'soul-drain-plus'],
    unlock: { kind: 'premium', description: 'Personagem premium: US$ 9,90.' }, provisional: true,
  }),
  defineUnit({
    id: 'protagonist-main-transformed', characterId: 'protagonist-main', version: 'Despertar',
    description: 'O despertar de Ravi durante a jornada revela uma força que ele ainda precisa compreender e aprender a controlar.',
    abilityIds: ['simple-strike-ii', 'female-special', 'retain-energy-plus', 'fury-scream'], provisional: true,
    unlock: battleUnlock('protagonist-main-transformed'),
  }),
  defineUnit({
    id: 'legendary-beast-premium', characterId: 'legendary-beast', version: 'Lendária',
    description: 'Uma presença rara que sugere forças muito além das conhecidas no vilarejo. Unidade premium disponível futuramente; habilidades atuais são temporárias.',
    abilityIds: ['heal-plus', 'female-special', 'retain-energy-plus', 'resurrection'], provisional: true,
    unlock: { kind: 'premium', description: 'Personagem premium: US$ 9,90.' },
  }),
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
