import type { CampaignMapData, QuickBattleData } from '@game/contracts.js';
import type { BattleAction, BattleRecord, BattleTurnResult } from '@game/core/battle.js';

export interface BattleRepository {
  getMap(userId: string, campaignId: string): Promise<CampaignMapData>;
  startBattle(userId: string, encounterId: string): Promise<BattleRecord>;
  getQuickBattle(userId: string): Promise<QuickBattleData>;
  startQuickBattle(userId: string): Promise<BattleRecord>;
  getBattle(userId: string, battleId: string): Promise<BattleRecord>;
  abandonBattle(userId: string, battleId: string): Promise<BattleRecord>;
  submitTurn(userId: string, battleId: string, revision: number, requestId: string, actions: BattleAction[]): Promise<BattleTurnResult>;
}
