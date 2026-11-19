// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createBattle } from '@game/core/battle';
import { STARTER_UNIT_IDS, units } from '@game/content/units';
import { abilities } from '@game/content/abilities';
import { perspectiveBattle } from './perspective';
import { MultiplayerClient } from './client';

afterEach(() => { vi.unstubAllGlobals(); window.sessionStorage.clear(); });
it('apresenta o lado enemy como equipe própria sem alterar IDs nem estado oficial', () => {
  const team = STARTER_UNIT_IDS.map((id) => units.find((u) => u.id === id)!);
  const battle = { id: 'match', encounterId: null, revision: 0, state: createBattle(team, team, Object.values(abilities)), log: [] };
  const original = structuredClone(battle);
  const view = perspectiveBattle(battle, 'enemy');
  expect(view.state.teams.player.units[0].id).toBe('enemy-0');
  expect(view.state.activeSide).toBe('enemy');
  expect(view.state.teams.enemy.energy).toBe(15);
  expect(battle).toEqual(original);
  battle.state.status = 'victory';
  expect(perspectiveBattle(battle, 'enemy').state.status).toBe('defeat');
});

class Socket {
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor() { Socket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}
it('aguarda confirmação, recebe estado antes do ack e rejeita pendências na desconexão', async () => {
  vi.stubGlobal('WebSocket', Socket);
  const client = new MultiplayerClient('user');
  client.start(); const socket = Socket.instances.at(-1)!; socket.open();
  const promise = client.command({ type: 'join' });
  const request = JSON.parse(socket.sent.at(-1)!);
  socket.message({ type: 'state', view: { phase: 'queued' } });
  socket.message({ type: 'ack', requestId: request.requestId });
  await promise;
  expect(client.getSnapshot().view.phase).toBe('queued');
  const pending = client.command({ type: 'cancel' });
  const rejected = expect(pending).rejects.toThrow();
  socket.onclose?.({ code: 1006 });
  await rejected;
  expect(client.getSnapshot().connected).toBe(false);
  client.stop();
});

it('ignora snapshot antigo e não reconecta quando outra aba assume a partida', () => {
  vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket);
  const client = new MultiplayerClient('user'); client.start();
  const socket = Socket.instances.at(-1)!; socket.open();
  socket.message({ type: 'state', view: { phase: 'active', matchId: 'match', sequence: 3 } });
  socket.message({ type: 'state', view: { phase: 'active', matchId: 'match', sequence: 2 } });
  expect(client.getSnapshot().view.sequence).toBe(3);
  const count = Socket.instances.length;
  socket.onclose?.({ code: 4001 }); vi.advanceTimersByTime(5000);
  expect(Socket.instances).toHaveLength(count);
  client.stop(); vi.useRealTimers();
});
