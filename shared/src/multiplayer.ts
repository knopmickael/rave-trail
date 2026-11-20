import type { BattleAction, BattleRecord, BattleSide } from './core/battle.js';

export type MultiplayerInput =
  | { type: 'join' }
  | { type: 'cancel' }
  | { type: 'sync'; matchId?: string }
  | { type: 'ready'; matchId: string }
  | { type: 'surrender'; matchId: string }
  | { type: 'draft'; matchId: string; revision: number; draftRevision: number; actions: BattleAction[] }
  | { type: 'turn'; matchId: string; revision: number; draftRevision: number };
export type MultiplayerCommand = MultiplayerInput & { requestId: string };
export interface MultiplayerResult {
  id: string;
  participantIds: [string, string];
  winnerId: string | null;
  loserId: string | null;
  teams: Record<string, string[]>;
  startedAt: string;
  completedAt: string;
  rounds: number;
  totalTurns: number;
  reason: 'combat' | 'surrender' | 'disconnect' | 'void';
}
export interface MultiplayerView {
  phase: 'idle' | 'queued' | 'preparing' | 'active' | 'finished';
  matchId?: string;
  sequence?: number;
  draftRevision?: number;
  mySide?: BattleSide;
  opponent?: { id: string; name: string };
  battle?: BattleRecord;
  disconnectedUntil?: string | null;
  result?: MultiplayerResult;
}
export interface MultiplayerUpdate { userId: string; view: MultiplayerView }
export type MultiplayerMessage =
  | { type: 'state'; view: MultiplayerView; requestId?: string }
  | { type: 'ack'; requestId: string }
  | { type: 'error'; requestId?: string; status: number; message: string };
