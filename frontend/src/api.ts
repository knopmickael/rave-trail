import type { CharacterUnlockData, GameCatalog, PlayerProgress, TeamSlots, User } from '@game/contracts';
import type { CampaignOption } from '@game/content/campaigns';
import type { CampaignMapData, QuickBattleData } from '@game/contracts';
import type { BattleAction, BattleRecord, BattleTurnResult } from '@game/core/battle';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

async function request<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
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
  if (!response.ok) throw new ApiError(data?.message ?? 'Não foi possível concluir a solicitação.', response.status);
  return data as T;
}

export const api = {
  async session(): Promise<User | null> {
    try {
      return (await request<{ user: User }>('/auth/me')).user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  async authenticate(mode: 'login' | 'register', email: string, password: string): Promise<User> {
    return (await request<{ user: User }>(`/auth/${mode}`, { email, password })).user;
  },
  logout: () => request<void>('/auth/logout', {}),
  async updateProfile(name: string): Promise<User> {
    return (await request<{ user: User }>('/profile', { name }, 'PATCH')).user;
  },
  async progress(): Promise<PlayerProgress> {
    return (await request<{ progress: PlayerProgress }>('/progress')).progress;
  },
  async catalog(): Promise<GameCatalog> {
    return (await request<{ catalog: GameCatalog }>('/catalog')).catalog;
  },
  async characterUnlocks(): Promise<CharacterUnlockData> {
    return (await request<{ unlocks: CharacterUnlockData }>('/character-unlocks')).unlocks;
  },
  async campaigns(): Promise<CampaignOption[]> {
    return (await request<{ campaigns: CampaignOption[] }>('/campaigns')).campaigns;
  },
  async campaignMap(id: string): Promise<CampaignMapData> {
    return (await request<{ map: CampaignMapData }>(`/campaigns/${encodeURIComponent(id)}/map`)).map;
  },
  async startBattle(encounterId: string): Promise<BattleRecord> {
    return (await request<{ battle: BattleRecord }>(`/encounters/${encodeURIComponent(encounterId)}/battles`, {})).battle;
  },
  async quickBattle(): Promise<QuickBattleData> {
    return (await request<{ quickBattle: QuickBattleData }>('/quick-battle')).quickBattle;
  },
  async startQuickBattle(): Promise<BattleRecord> {
    return (await request<{ battle: BattleRecord }>('/quick-battle/battles', {})).battle;
  },
  async battle(id: string): Promise<BattleRecord> {
    return (await request<{ battle: BattleRecord }>(`/battles/${id}`)).battle;
  },
  async abandonBattle(id: string): Promise<BattleRecord> {
    return (await request<{ battle: BattleRecord }>(`/battles/${id}/abandon`, {})).battle;
  },
  turn(id: string, revision: number, requestId: string, actions: BattleAction[]) {
    return request<BattleTurnResult>(`/battles/${id}/turns`, { revision, requestId, actions });
  },
  async setTeamSlot(slot: number, unitId: string | null): Promise<TeamSlots> {
    return (await request<{ team: TeamSlots }>(`/team/slots/${slot}`, { unitId }, 'PUT')).team;
  },
};
