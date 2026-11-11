import type { CharacterUnlockData, GameCatalog, PlayerProgress, TeamSlots, User } from '@game/contracts';
import type { CampaignOption } from '@game/content/campaigns';
import type { CampaignBattleOptions, CampaignMapData, QuickBattleData } from '@game/contracts';
import type { BattleAction, BattleRecord, BattleTurnResult } from '@game/core/battle';
import { DataCache } from './data-cache';
import { preloadDataAssets } from './asset-preloader';

export const gameDataCache = new DataCache();
const sessionCache = new DataCache();
let generation = 0;
const finishedBattles = new Set<string>();

export function clearGameData() {
  generation++;
  gameDataCache.clear();
  sessionCache.clear();
  finishedBattles.clear();
}

function cached<T>(key: string, fetcher: () => Promise<T>) {
  return gameDataCache.load(key, async () => {
    const data = await fetcher();
    preloadDataAssets(data);
    return data;
  });
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

async function request<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const current = generation;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Tente novamente.', 0);
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && current === generation) clearGameData();
    throw new ApiError(data?.message ?? 'Não foi possível concluir a solicitação.', response.status);
  }
  return data as T;
}

export const api = {
  async session(): Promise<User | null> {
    return sessionCache.load('session', async () => {
      try { return (await request<{ user: User }>('/auth/me')).user; }
      catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    });
  },
  async authenticate(mode: 'login' | 'register', email: string, password: string): Promise<User> {
    const user = (await request<{ user: User }>(`/auth/${mode}`, { email, password })).user;
    clearGameData();
    sessionCache.set('session', user);
    return user;
  },
  async logout() { await request<void>('/auth/logout', {}); clearGameData(); },
  async updateProfile(name: string): Promise<User> {
    const current = generation;
    const user = (await request<{ user: User }>('/profile', { name }, 'PATCH')).user;
    if (current === generation) sessionCache.set('session', user);
    return user;
  },
  async progress(): Promise<PlayerProgress> {
    return cached('progress', async () => (await request<{ progress: PlayerProgress }>('/progress')).progress);
  },
  async catalog(): Promise<GameCatalog> {
    return cached('catalog', async () => (await request<{ catalog: GameCatalog }>('/catalog')).catalog);
  },
  async characterUnlocks(): Promise<CharacterUnlockData> {
    return cached('unlocks', async () => (await request<{ unlocks: CharacterUnlockData }>('/character-unlocks')).unlocks);
  },
  async campaigns(): Promise<CampaignOption[]> {
    return cached('campaigns', async () => (await request<{ campaigns: CampaignOption[] }>('/campaigns')).campaigns);
  },
  async campaignMap(id: string): Promise<CampaignMapData> {
    return cached(`map:${id}`, async () => (await request<{ map: CampaignMapData }>(`/campaigns/${encodeURIComponent(id)}/map`)).map);
  },
  async startBattle(encounterId: string, options: CampaignBattleOptions = {}): Promise<BattleRecord> {
    return requestBattle(`/encounters/${encodeURIComponent(encounterId)}/battles`, options);
  },
  async quickBattle(): Promise<QuickBattleData> {
    return cached('quick-battle', async () => (await request<{ quickBattle: QuickBattleData }>('/quick-battle')).quickBattle);
  },
  async startQuickBattle(): Promise<BattleRecord> {
    return requestBattle('/quick-battle/battles', {});
  },
  async battle(id: string): Promise<BattleRecord> {
    return requestBattle(`/battles/${id}`);
  },
  async abandonBattle(id: string): Promise<BattleRecord> {
    return requestBattle(`/battles/${id}/abandon`, {});
  },
  async turn(id: string, revision: number, requestId: string, actions: BattleAction[]) {
    const current = generation;
    const result = await request<BattleTurnResult>(`/battles/${id}/turns`, { revision, requestId, actions });
    if (current === generation) acceptBattle(result.battle);
    return result;
  },
  async setTeamSlot(slot: number, unitId: string | null): Promise<TeamSlots> {
    const current = generation;
    const team = (await request<{ team: TeamSlots }>(`/team/slots/${slot}`, { unitId }, 'PUT')).team;
    if (current !== generation) return team;
    const progress = gameDataCache.peek<PlayerProgress>('progress');
    if (progress) gameDataCache.set('progress', { ...progress, selectedTeam: team });
    else gameDataCache.delete('progress');
    return team;
  },
};

/** Preload all accessible screens; locked maps are requested when they unlock. */
export async function preloadGameData(client = api) {
  const current = generation;
  const maps = client.campaigns().then((campaigns) => current === generation
    ? Promise.all(campaigns.filter((campaign) => campaign.available).map((campaign) => client.campaignMap(campaign.id))) : []);
  await Promise.all([client.catalog(), client.progress(), client.characterUnlocks(), client.quickBattle(), maps]);
}

async function requestBattle(path: string, body?: unknown) {
  const current = generation;
  const { battle } = await request<{ battle: BattleRecord }>(path, body);
  return current === generation ? acceptBattle(battle) : battle;
}

function acceptBattle(battle: BattleRecord): BattleRecord {
  preloadDataAssets(battle.state);
  if (battle.state.status === 'victory' && !finishedBattles.has(battle.id)) {
    finishedBattles.add(battle.id);
    const keys = ['progress', 'unlocks', 'quick-battle'];
    if (battle.encounterId !== null) {
      keys.push('campaigns');
      gameDataCache.deletePrefix('map:');
    }
    for (const key of keys) gameDataCache.delete(key);
    // Refresh immediately while the result is displayed. Failed entries remain retryable
    // by the destination screen without misreporting an accepted battle action as failed.
    const refresh = battle.encounterId === null
      ? Promise.all([api.progress(), api.characterUnlocks(), api.quickBattle()]) : preloadGameData();
    void refresh.catch(() => {});
  }
  return battle;
}
