import type { Pool, PoolClient } from 'pg';
import { QUICK_BATTLE_COOLDOWN_MESSAGE, QUICK_BATTLE_COOLDOWN_MS, QUICK_BATTLE_SURRENDER_LIMIT, QUICK_BATTLE_SURRENDER_WINDOW_MS } from '@game/content/quick-battle-rules.js';
import { GameError } from '../game/repository.js';

export async function readQuickBattleBlock(client: Pool | PoolClient, userId: string, now: number): Promise<string | null> {
  const row = (await client.query<{ until: Date | null }>('SELECT quick_battle_blocked_until AS until FROM player_progress WHERE user_id=$1', [userId])).rows[0];
  return row?.until && row.until.getTime() > now ? row.until.toISOString() : null;
}

/** O chamador mantém o lock de player_progress até gravar a desistência e o limite. */
export async function recordQuickBattleSurrenders(client: PoolClient, userId: string, now: number, count = 1): Promise<void> {
  if (!count) return;
  const row = (await client.query<{ abandons: Date[]; until: Date | null }>(
    'SELECT quick_battle_abandons AS abandons,quick_battle_blocked_until AS until FROM player_progress WHERE user_id=$1', [userId])).rows[0];
  if (row.until && row.until.getTime() > now) return;
  const recent = row.abandons.filter((date) => date.getTime() > now - QUICK_BATTLE_SURRENDER_WINDOW_MS);
  let until: Date | null = null;
  for (let i = 0; i < count; i++) {
    recent.push(new Date(now));
    if (recent.length >= QUICK_BATTLE_SURRENDER_LIMIT) { recent.length = 0; until = new Date(now + QUICK_BATTLE_COOLDOWN_MS); break; }
  }
  await client.query('UPDATE player_progress SET quick_battle_abandons=$2,quick_battle_blocked_until=$3 WHERE user_id=$1', [userId, recent, until]);
}

export function quickBattleBlocked(until: string, now: number) {
  return new GameError(429, QUICK_BATTLE_COOLDOWN_MESSAGE, until, new Date(now).toISOString());
}
