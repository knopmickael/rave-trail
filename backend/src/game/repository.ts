import type { CharacterUnlockData, GameCatalog, TeamSlots } from '@game/contracts.js';
import type { CampaignOption } from '@game/content/campaigns.js';

export class GameError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}

export interface GameRepository {
  getCatalog(): Promise<GameCatalog>;
  getCampaigns(userId: string): Promise<CampaignOption[]>;
  getCharacterUnlocks(userId: string): Promise<CharacterUnlockData>;
  setTeamSlot(userId: string, slot: number, unitId: string | null): Promise<TeamSlots>;
}
