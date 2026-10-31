export interface User {
  id: string;
  email: string;
  name: string;
  sessionExpiresAt?: string;
}

export interface PlayerProgress {
  schemaVersion: 1;
  audioEnabled: boolean;
  completedEncounters: string[];
  unlockedUnitIds: string[];
  selectedTeam: TeamSlots;
  availablePathIds: string[];
  missionProgressResets?: Record<string, string>;
}

export function createInitialProgress(): PlayerProgress {
  const starters = [...STARTER_UNIT_IDS];
  return {
    schemaVersion: 1,
    audioEnabled: true,
    completedEncounters: [],
    unlockedUnitIds: starters,
    selectedTeam: [null, null, null],
    availablePathIds: ['path-1'],
  };
}
export type TeamSlots = [string | null, string | null, string | null];

export interface GameCatalog {
  characters: readonly NarrativeCharacter[];
  units: readonly UnitDefinition[];
  abilities: readonly AbilityDefinition[];
}
export interface CampaignMapData {
  campaign: import('./content/campaigns.js').CampaignOption;
  encounters: import('./content/encounters.js').EncounterOption[];
}
export interface QuickBattleData {
  opponents: readonly Pick<UnitDefinition, 'id' | 'name' | 'portrait'>[];
}
export type CharacterUnlockProgress = Pick<UnitDefinition, 'id' | 'name' | 'portrait'> & {
  unlocked: boolean;
  campaignAvailable: boolean;
} & ({
  kind: 'battle-wins';
  requirements: readonly { description: string; current: number; target: number }[];
} | {
  kind: 'premium';
  priceUsd: number;
});
export interface CharacterUnlockData {
  characters: readonly CharacterUnlockProgress[];
}
import { STARTER_UNIT_IDS } from './content/units.js';
import type { NarrativeCharacter, UnitDefinition } from './content/units.js';
import type { AbilityDefinition } from './content/abilities.js';
