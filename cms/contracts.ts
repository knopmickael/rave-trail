import type { AbilityDefinition, AbilityEffect } from '../shared/src/content/abilities.js';
import type { BattleUnlockRule } from '../shared/src/content/unlocks.js';

export type Entity = 'characters' | 'abilities' | 'campaigns' | 'encounters';
export interface Character {
  id: string; characterId: string; name: string; version: string; description: string;
  maxHp: number; portrait: string; illustration: string; abilityIds: string[];
  unlock: { kind: 'starter' | 'premium' | 'battle-wins'; description: string };
  unlockRule: BattleUnlockRule | null; priceUsd: number | null;
  rosterOrder: number | null;
}
export interface Campaign {
  id: string; chapterNumber: number; title: string; description: string; background: string;
  mapBackground: string | null; prerequisiteEncounterId: string | null; sortOrder: number; released: boolean;
}
export interface Encounter {
  id: string; campaignId: string; position: number; title: string; story: string;
  mapX: number; mapY: number; enemyUnitIds: string[];
}
export interface Setup { id: string; name: string; config: Pick<AbilityDefinition, 'energyCost' | 'target' | 'effects'> }
export interface Catalog { characters: Character[]; abilities: AbilityDefinition[]; campaigns: Campaign[]; encounters: Encounter[]; setups: Setup[] }
export interface AiProposal {
  message: string; ability: AbilityDefinition | null;
  engineExtension: { summary: string; reason: string; suggestedConfig: string } | null;
}
export interface Status { token: string; database: string; ready: boolean; message: string; aiReady: boolean }

export const targets: Record<AbilityDefinition['target'], string> = {
  enemy: 'Inimigo específico', ally: 'Aliado específico (inclui usuário)', self: 'Próprio usuário',
  'defeated-ally': 'Aliado derrotado', 'all-enemies': 'Todos os inimigos', 'all-allies': 'Todos os aliados', team: 'Equipe (energia / turno)',
};
export const effectSpecs: Record<AbilityEffect['kind'], { label: string; fields: Record<string, { label: string; min: number; max: number; step?: number; initial: number }> }> = {
  damage: { label: 'Ataque / dano', fields: { amount: { label: 'Dano', min: 1, max: 10000, initial: 20 } } },
  heal: { label: 'Cura', fields: { amount: { label: 'HP restaurado', min: 1, max: 10000, initial: 20 } } },
  drain: { label: 'Drenagem de vida', fields: { amount: { label: 'Dano convertido em cura', min: 1, max: 10000, initial: 25 } } },
  revive: { label: 'Ressurreição', fields: { hpRatio: { label: 'Fração de HP (0–1)', min: 0.01, max: 1, step: 0.01, initial: 0.5 } } },
  guard: { label: 'Defesa / guarda', fields: { reduction: { label: 'Redução por golpe', min: 1, max: 10000, initial: 10 }, teamTurns: { label: 'Turnos da equipe', min: 1, max: 20, initial: 2 } } },
  'restore-energy': { label: 'Recuperar energia', fields: { amount: { label: 'Energia', min: 1, max: 100, initial: 20 } } },
  'extra-turn': { label: 'Turnos extras', fields: { count: { label: 'Quantidade', min: 1, max: 3, initial: 1 } } },
  bleed: { label: 'Sangramento', fields: { amount: { label: 'Dano por turno', min: 1, max: 10000, initial: 10 }, turns: { label: 'Turnos do alvo', min: 1, max: 20, initial: 3 } } },
  invulnerable: { label: 'Invulnerabilidade', fields: { teamTurns: { label: 'Turnos', min: 1, max: 20, initial: 1 } } },
  'attack-block': { label: 'Bloquear ataques', fields: { teamTurns: { label: 'Turnos', min: 1, max: 20, initial: 1 } } },
  'damage-boost': { label: 'Bônus de ataque', fields: { amount: { label: 'Dano adicional', min: 1, max: 10000, initial: 10 }, teamTurns: { label: 'Turnos futuros da equipe', min: 1, max: 20, initial: 2 } } },
};
