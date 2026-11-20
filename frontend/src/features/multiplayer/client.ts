import type { MultiplayerCommand, MultiplayerInput, MultiplayerMessage, MultiplayerView } from '@game/multiplayer';

export const multiplayerStorageKey = (userId: string) => `rave-trail-multiplayer-${userId}`;
interface Snapshot { view: MultiplayerView; connected: boolean; error: string; expired: boolean }
interface Pending { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }

export class MultiplayerClient {
  private snapshot: Snapshot = { view: { phase: 'idle' }, connected: false, error: '', expired: false };
  private socket: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private pending = new Map<string, Pending>();
  private retry: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private retryDelay = 300;
  constructor(private readonly userId: string) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private remembered() {
    try { return window.sessionStorage.getItem(multiplayerStorageKey(this.userId)) ?? undefined; } catch { return undefined; }
  }
  private remember(view: MultiplayerView) {
    try {
      if (view.matchId && view.phase !== 'finished') window.sessionStorage.setItem(multiplayerStorageKey(this.userId), view.matchId);
      else window.sessionStorage.removeItem(multiplayerStorageKey(this.userId));
    } catch { /* Current connection still works without storage. */ }
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.open();
  }
  private open() {
    if (this.stopped) return;
    const url = new URL('/api/multiplayer/live', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket || this.stopped) return;
      this.retryDelay = 300;
      this.update({ connected: true, error: '', expired: false });
      const matchId = this.remembered();
      void this.command({ type: 'sync', ...(matchId ? { matchId } : {}) }).catch(() => {});
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.stopped) return;
      let message: MultiplayerMessage;
      try { message = JSON.parse(event.data) as MultiplayerMessage; } catch { socket.close(); return; }
      if (message.type === 'state') {
        const old = this.snapshot.view;
        if (old.matchId === message.view.matchId && (message.view.sequence ?? Infinity) < (old.sequence ?? -1)) return;
        this.remember(message.view);
        this.update({ view: message.view });
      } else if (message.type === 'ack') {
        const pending = this.pending.get(message.requestId);
        if (pending) { clearTimeout(pending.timer); this.pending.delete(message.requestId); pending.resolve(); }
      } else if (message.type === 'error') {
        this.update({ error: message.message, expired: message.status === 401 });
        const pending = message.requestId ? this.pending.get(message.requestId) : undefined;
        if (pending) { clearTimeout(pending.timer); this.pending.delete(message.requestId!); pending.reject(new Error(message.message)); }
      }
    };
    socket.onerror = () => { /* close drives retry; never infer surrender on the client. */ };
    socket.onclose = (event) => {
      if (this.socket !== socket || this.stopped) return;
      this.rejectPending();
      this.update({ connected: false, error: event.code === 4001 ? 'Outra conexão controla esta partida.' : 'Reconectando à partida…', expired: event.code === 4003 || this.snapshot.expired });
      if (event.code === 4001 || this.snapshot.expired) return;
      this.retry = setTimeout(() => this.open(), this.retryDelay);
      this.retryDelay = Math.min(2000, this.retryDelay * 2);
    };
  }
  async command(input: MultiplayerInput): Promise<void> {
    if (!this.socket || this.socket.readyState !== 1 || !this.snapshot.connected) throw new Error('Aguarde a conexão com o servidor.');
    const command: MultiplayerCommand = { ...input, requestId: crypto.randomUUID() };
    this.update({ error: '' });
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.requestId);
        reject(new Error('Não foi possível confirmar o comando. Sincronize a partida.'));
        // Unknown outcome: reconnect/snapshot instead of blindly issuing another mutation.
        this.socket?.close();
      }, 5000);
      this.pending.set(command.requestId, { resolve, reject, timer });
      this.socket!.send(JSON.stringify(command));
    });
  }
  private rejectPending() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer); pending.reject(new Error('Conexão interrompida. Aguarde a sincronização.'));
    }
    this.pending.clear();
  }
  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.rejectPending();
    const socket = this.socket; this.socket = null;
    socket?.close();
    this.update({ connected: false });
  }
}
