import { randomUUID } from 'node:crypto';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import { BattleRuleError } from '@game/core/battle.js';
import type { User } from '@game/contracts.js';
import type { MultiplayerMessage, MultiplayerUpdate } from '@game/multiplayer.js';
import { hashSessionToken } from '../auth/crypto.js';
import type { AuthRepository } from '../auth/repository.js';
import type { PostgresMultiplayer } from '../db/multiplayer.js';
import { GameError } from './repository.js';

const uuid = z.uuid();
const base = { requestId: uuid };
const version = { matchId: uuid, revision: z.number().int().nonnegative(), draftRevision: z.number().int().nonnegative() };
const action = z.object({ actorId: z.string().max(40), abilityId: z.string().max(100), targetId: z.string().max(40).optional() }).strict();
const commandSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('join') }).strict(),
  z.object({ ...base, type: z.literal('cancel') }).strict(),
  z.object({ ...base, type: z.literal('sync'), matchId: uuid.optional() }).strict(),
  z.object({ ...base, type: z.literal('ready'), matchId: uuid }).strict(),
  z.object({ ...base, type: z.literal('surrender'), matchId: uuid }).strict(),
  z.object({ ...base, ...version, type: z.literal('draft'), actions: z.array(action).max(3) }).strict(),
  z.object({ ...base, ...version, type: z.literal('turn') }).strict(),
]);
interface Connection { socket: WebSocket; id: string; hash: string; alive: boolean; windowAt: number; count: number; pending: number }

export async function registerMultiplayerSocket(app: FastifyInstance, service: PostgresMultiplayer, auth: AuthRepository, origin: string) {
  const connections = new Map<string, Connection>();
  const identities = new WeakMap<FastifyRequest, { user: User; hash: string }>();
  let stopping = false;
  let recoveryNeeded = false;
  let pendingMessages = 0;
  let metrics = { commands: 0, rejected: 0, latencyMs: 0, disconnects: 0, results: 0, voids: 0 };
  let metricsAt = Date.now();
  let chain: Promise<unknown> = Promise.resolve();
  const serial = (work: () => Promise<void>) => {
    const result = chain.then(async () => {
      if (recoveryNeeded && !stopping) {
        // No competitive decision may use connection presence that failed to persist.
        // A database interruption is infrastructure failure: reconcile by voiding, not by awarding wins.
        publish(await service.initialize());
        recoveryNeeded = false;
      }
      await work();
    });
    chain = result.catch((error: unknown) => { recoveryNeeded = true; app.log.error({ err: error }, 'Falha no serviço multiplayer'); });
    return result;
  };
  const send = (connection: Connection, message: MultiplayerMessage) => {
    if (connection.socket.readyState !== 1) return;
    if (connection.socket.bufferedAmount > 256 * 1024) { connection.socket.terminate(); return; }
    connection.socket.send(JSON.stringify(message));
  };
  const publish = (updates: MultiplayerUpdate[]) => {
    for (const { userId, view } of updates) {
      if (view.result && userId === view.result.participantIds[0]) {
        metrics.results++; if (view.result.reason === 'void') metrics.voids++;
      }
      const connection = connections.get(userId);
      if (connection) send(connection, { type: 'state', view });
    }
  };
  const failure = (connection: Connection, error: unknown, requestId?: string) => {
    metrics.rejected++;
    const status = error instanceof GameError ? error.statusCode : error instanceof BattleRuleError ? 400 : 503;
    send(connection, { type: 'error', requestId, status, message: status === 503 ? 'Não foi possível sincronizar a partida. Tente novamente.' : (error as Error).message });
    if (status === 503) { recoveryNeeded = true; app.log.error({ err: error }, 'Falha ao processar comando multiplayer'); }
  };

  await app.register(websocket, {
    options: { maxPayload: 16 * 1024, perMessageDeflate: false },
    preClose: async function () {
      stopping = true;
      clearInterval(timer);
      await serial(async () => { publish(await service.initialize()); });
      for (const connection of connections.values()) connection.socket.terminate();
      connections.clear();
      await new Promise<void>((resolve) => app.websocketServer.close(() => resolve()));
    },
  });

  app.get('/api/multiplayer/live', {
    websocket: true,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preValidation: async (request, reply) => {
      if (stopping) return reply.code(503).send({ message: 'Servidor em manutenção.' });
      if (request.headers.origin !== origin) return reply.code(403).send({ message: 'Origem da requisição não permitida.' });
      const token = request.cookies.rave_trail_session;
      const hash = token ? hashSessionToken(token) : '';
      const user = hash ? await auth.findSession(hash) : null;
      if (!user) return reply.code(401).send({ message: 'Sua sessão expirou. Entre novamente para continuar.' });
      if (connections.size >= 512 && !connections.has(user.id)) return reply.code(503).send({ message: 'Multiplayer temporariamente ocupado.' });
      identities.set(request, { user, hash });
    },
  }, (socket, request) => {
    const { user, hash } = identities.get(request)!;
    const previous = connections.get(user.id);
    const connection: Connection = { socket, hash, id: randomUUID(), alive: true, windowAt: Date.now(), count: 0, pending: 0 };
    connections.set(user.id, connection);
    previous?.socket.close(4001, 'Outra conexão assumiu a partida.');
    socket.on('pong', () => { connection.alive = true; });
    socket.on('error', (error) => { request.log.info({ err: error }, 'Conexão multiplayer encerrada'); });
    // Attach listeners synchronously: no messages may be lost during database authentication/restore.
    socket.on('message', (raw, binary) => {
      if (stopping || connections.get(user.id) !== connection) return;
      if (Date.now() - connection.windowAt >= 1000) { connection.windowAt = Date.now(); connection.count = 0; }
      if (++connection.count > 30 || binary) { socket.close(1008, 'Limite de mensagens ou formato inválido.'); return; }
      let parsed: ReturnType<typeof commandSchema.safeParse>;
      try { parsed = commandSchema.safeParse(JSON.parse(raw.toString())); }
      catch { parsed = commandSchema.safeParse(null); }
      if (!parsed.success) {
        send(connection, { type: 'error', status: 400, message: 'Mensagem multiplayer inválida.' });
        return;
      }
      const command = parsed.data;
      const receivedAt = Date.now();
      if (connection.pending >= 16 || pendingMessages >= 256) {
        socket.close(1008, 'Muitos comandos pendentes.'); return;
      }
      connection.pending++; pendingMessages++;
      void serial(async () => {
        if (stopping || connections.get(user.id) !== connection || socket.readyState !== 1) return;
        try {
          if (!await auth.findSession(hash)) {
            send(connection, { type: 'error', requestId: command.requestId, status: 401, message: 'Sua sessão expirou. Entre novamente para continuar.' });
            socket.close(4003, 'Sessão expirada.'); return;
          }
          publish(await service.command(user.id, connection.id, command));
          send(connection, { type: 'ack', requestId: command.requestId });
          metrics.commands++; metrics.latencyMs += Date.now() - receivedAt;
        } catch (error) {
          failure(connection, error, command.requestId);
          if (error instanceof GameError && error.statusCode === 409) {
            publish(await service.command(user.id, connection.id, { type: 'sync', requestId: randomUUID() }));
          }
        }
      }).catch(() => { socket.close(1011, 'Falha de sincronização.'); })
        .finally(() => { connection.pending--; pendingMessages--; });
    });
    socket.on('close', () => {
      if (connections.get(user.id) !== connection) return;
      connections.delete(user.id);
      metrics.disconnects++;
      if (!stopping) void serial(async () => { publish(await service.disconnect(user.id, connection.id)); }).catch(() => {});
    });
    void serial(async () => { publish(await service.connect(user.id, connection.id)); }).catch((error) => {
      failure(connection, error); socket.close(1011, 'Falha de sincronização.');
    });
  });

  let ticking = false;
  let lastHeartbeat = 0;
  const timer = setInterval(() => {
    if (stopping || ticking) return;
    ticking = true;
    void serial(async () => {
      if (Date.now() - lastHeartbeat >= 5000) {
        lastHeartbeat = Date.now();
        for (const connection of connections.values()) {
          if (!connection.alive) { connection.socket.terminate(); continue; }
          if (!await auth.findSession(connection.hash)) {
            send(connection, { type: 'error', status: 401, message: 'Sua sessão expirou. Entre novamente para continuar.' });
            connection.socket.close(4003, 'Sessão expirada.'); continue;
          }
          connection.alive = false; connection.socket.ping();
        }
      }
      publish(await service.tick());
      if (Date.now() - metricsAt >= 30_000) {
        app.log.info({ multiplayer: { ...metrics, connections: connections.size, pendingMessages,
          averageCommandMs: metrics.commands ? Math.round(metrics.latencyMs / metrics.commands) : 0 } }, 'Métricas multiplayer');
        metrics = { commands: 0, rejected: 0, latencyMs: 0, disconnects: 0, results: 0, voids: 0 }; metricsAt = Date.now();
      }
    }).catch(() => {}).finally(() => { ticking = false; });
  }, 1000);
  timer.unref();
}
