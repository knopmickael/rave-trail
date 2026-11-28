import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PlayerProgress } from '@game/contracts.js';
import type { UnitDefinition } from '@game/content/units.js';
import type { AbilityDefinition } from '@game/content/abilities.js';
import { createBattle, executeTurn, previewActions, TURN_DURATION_MS, type BattleRecord, type BattleSide } from '@game/core/battle.js';
import type { MultiplayerCommand, MultiplayerResult, MultiplayerUpdate, MultiplayerView } from '@game/multiplayer.js';
import { GameError } from '../game/repository.js';
import { PostgresGameRepository, readTeam } from './game-repository.js';
import { synchronizeCharacterUnlocks } from './character-unlocks.js';

interface Entrant { userId: string; name: string; units: UnitDefinition[]; abilities: AbilityDefinition[] }
interface Participant { userId: string; name: string; connectionId: string; ready: boolean; disconnectedAt: number | null; team: string[] }
interface Match {
  id: string; phase: 'preparing' | 'active'; players: [Participant, Participant]; battle: BattleRecord;
  sequence: number; draftRevision: number; createdAt: number; startedAt: number; rounds: number; totalTurns: number;
}
interface Entry { user_id: string; match_id: string | null; connection_id: string; data: Entrant }
const DISCONNECT_MS = 10_000;
const PREPARE_MS = 20_000;
// Limit pathological matches and bound temporary logs/command deduplication.
const MAX_MATCH_MS = 60 * 60_000;
const sides: BattleSide[] = ['player', 'enemy'];

export class PostgresMultiplayer {
  private readonly now: () => number;
  private readonly randomIndex: (max: number) => number;
  constructor(private readonly pool: Pool, options: { now?: () => number; randomIndex?: (max: number) => number } = {}) {
    this.now = options.now ?? Date.now;
    this.randomIndex = options.randomIndex ?? randomInt;
  }

  private async transaction(work: (client: PoolClient) => Promise<MultiplayerUpdate[]>): Promise<MultiplayerUpdate[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Single-process MVP: serializes FIFO, cancellations, deadlines and finalization.
      await client.query('SELECT pg_advisory_xact_lock(72583620)');
      const updates = await work(client);
      await client.query('COMMIT');
      return updates;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private async entry(client: PoolClient, userId: string) {
    return (await client.query<Entry>('SELECT * FROM multiplayer_entries WHERE user_id=$1', [userId])).rows[0];
  }
  private async load(client: PoolClient, id: string) {
    return (await client.query<{ data: Match }>('SELECT data FROM multiplayer_matches WHERE id=$1 FOR UPDATE', [id])).rows[0]?.data;
  }
  private async save(client: PoolClient, match: Match) {
    await client.query('UPDATE multiplayer_matches SET data=$2, updated_at=now() WHERE id=$1', [match.id, JSON.stringify(match)]);
  }
  private views(match: Match, result?: MultiplayerResult): MultiplayerUpdate[] {
    return match.players.map((player, index) => ({ userId: player.userId, view: {
      phase: result ? 'finished' : match.phase, matchId: match.id, mySide: sides[index],
      sequence: match.sequence, draftRevision: match.draftRevision,
      opponent: { id: match.players[1 - index].userId, name: match.players[1 - index].name },
      battle: match.battle, result,
      disconnectedUntil: match.players[1 - index].disconnectedAt === null ? null
        : new Date(match.players[1 - index].disconnectedAt! + DISCONNECT_MS).toISOString(),
    } }));
  }

  private async current(client: PoolClient, userId: string, matchId?: string): Promise<MultiplayerUpdate[]> {
    const entry = await this.entry(client, userId);
    if (entry?.match_id) {
      const match = await this.load(client, entry.match_id);
      if (match) return this.views(match).filter((update) => update.userId === userId);
    }
    if (entry) return [{ userId, view: { phase: 'queued' } }];
    if (matchId) {
      const row = (await client.query<{ data: MultiplayerResult }>(
        'SELECT data FROM multiplayer_results WHERE id=$1 AND (player_id=$2 OR enemy_id=$2)', [matchId, userId])).rows[0];
      if (!row) throw new GameError(404, 'Partida não encontrada.');
      return [{ userId, view: { phase: 'finished', matchId, result: row.data } }];
    }
    return [{ userId, view: { phase: 'idle' } }];
  }

  async connect(userId: string, connectionId: string) {
    return this.transaction(async (client) => {
      const entry = await this.entry(client, userId);
      if (entry) {
        await client.query('UPDATE multiplayer_entries SET connection_id=$2 WHERE user_id=$1', [userId, connectionId]);
        if (entry.match_id) {
          const match = (await this.load(client, entry.match_id))!;
          // A late reconnect may not revive a match whose abandonment deadline passed.
          const due = await this.advance(client, match);
          if (due?.some((update) => update.view.phase === 'finished')) return due;
          const player = match.players.find((p) => p.userId === userId)!;
          player.connectionId = connectionId; player.disconnectedAt = null;
          match.sequence++; await this.save(client, match);
          return this.views(match);
        }
      }
      return this.current(client, userId);
    });
  }

  async disconnect(userId: string, connectionId: string) {
    return this.transaction(async (client) => {
      const entry = await this.entry(client, userId);
      if (!entry || entry.connection_id !== connectionId) return [];
      if (!entry.match_id) {
        await client.query('DELETE FROM multiplayer_entries WHERE user_id=$1', [userId]);
        return [{ userId, view: { phase: 'idle' } }];
      }
      const match = (await this.load(client, entry.match_id))!;
      const player = match.players.find((p) => p.userId === userId)!;
      player.disconnectedAt ??= this.now();
      match.sequence++; await this.save(client, match);
      return this.views(match);
    });
  }

  async command(userId: string, connectionId: string, command: MultiplayerCommand) {
    return this.transaction(async (client) => {
      if (command.type === 'sync') return this.current(client, userId, command.matchId);
      if (command.type === 'join') return this.join(client, userId, connectionId);
      const entry = await this.entry(client, userId);
      if (entry && entry.connection_id !== connectionId) throw new GameError(409, 'Outra conexão controla esta partida.');
      if (command.type === 'cancel') {
        if (entry?.match_id) return this.current(client, userId);
        await client.query('DELETE FROM multiplayer_entries WHERE user_id=$1', [userId]);
        return [{ userId, view: { phase: 'idle' } }];
      }
      if (!entry?.match_id || entry.match_id !== command.matchId) return this.current(client, userId, command.matchId);
      const match = (await this.load(client, entry.match_id))!;
      const playerIndex = match.players.findIndex((player) => player.userId === userId);
      const signature = createHash('sha256').update(JSON.stringify(command)).digest('hex');
      const duplicate = (await client.query<{ signature: string }>(
        'SELECT signature FROM multiplayer_commands WHERE match_id=$1 AND user_id=$2 AND request_id=$3', [match.id, userId, command.requestId])).rows[0];
      if (duplicate) {
        if (duplicate.signature !== signature) throw new GameError(409, 'Identificador de comando reutilizado.');
        return this.views(match);
      }
      const advanced = await this.advance(client, match);
      if (advanced && (command.type !== 'surrender' || advanced.some((update) => update.view.phase === 'finished'))) return advanced;
      if (command.type === 'surrender') {
        if (match.phase !== 'active') return this.finish(client, match, null, 'void');
        return this.finish(client, match, 1 - playerIndex, 'surrender');
      }
      if (command.type === 'ready') {
        match.players[playerIndex].ready = true;
        if (match.phase === 'preparing' && match.players.every((player) => player.ready && player.disconnectedAt === null)) {
          match.phase = 'active'; match.startedAt = this.now();
          match.battle.turnDeadlineAt = new Date(this.now() + TURN_DURATION_MS).toISOString();
        }
      } else {
        if (match.phase !== 'active') throw new GameError(409, 'A partida ainda não começou.');
        if (match.battle.state.activeSide !== sides[playerIndex]) throw new GameError(403, 'Aguarde o turno da sua equipe.');
        if (command.revision !== match.battle.revision || command.draftRevision !== match.draftRevision) throw new GameError(409, 'O turno ou o combo já mudou. Atualize a partida.');
        if (command.type === 'draft') {
          previewActions(match.battle.state, command.actions);
          match.battle.combo = { side: match.battle.state.activeSide, actions: command.actions };
          match.draftRevision++;
        } else {
          this.turn(match, false);
          if (match.battle.state.status !== 'active') return this.finish(client, match, match.battle.state.status === 'victory' ? 0 : 1, 'combat');
        }
      }
      match.sequence++;
      await this.save(client, match);
      await client.query('INSERT INTO multiplayer_commands(match_id,user_id,request_id,signature) VALUES($1,$2,$3,$4)', [match.id, userId, command.requestId, signature]);
      return this.views(match);
    });
  }

  private async join(client: PoolClient, userId: string, connectionId: string): Promise<MultiplayerUpdate[]> {
    const existing = await this.entry(client, userId);
    if (existing) {
      if (existing.connection_id !== connectionId) throw new GameError(409, 'Outra conexão controla esta partida.');
      return this.current(client, userId);
    }
    const progress = (await client.query<{ data: PlayerProgress }>('SELECT data FROM player_progress WHERE user_id=$1 FOR UPDATE', [userId])).rows[0]?.data;
    if (!progress) throw new GameError(404, 'Progresso não encontrado.');
    if ((await client.query("SELECT 1 FROM battles WHERE user_id=$1 AND status='active' LIMIT 1", [userId])).rowCount) throw new GameError(409, 'Conclua ou desista da batalha atual antes de buscar uma partida.');
    const team = await readTeam(client, userId);
    if (team.some((id) => id === null) || new Set(team).size !== 3) throw new GameError(400, 'Escolha três personagens para jogar multiplayer.');
    if (team.some((id) => !progress.unlockedUnitIds.includes(id!))) throw new GameError(403, 'A equipe contém um personagem bloqueado.');
    const catalog = await new PostgresGameRepository(this.pool).getCatalog(client);
    const units = team.map((id) => catalog.units.find((unit) => unit.id === id)!);
    if (units.some((unit) => !unit)) throw new GameError(400, 'Personagem indisponível.');
    const name = (await client.query<{ name: string }>('SELECT name FROM users WHERE id=$1', [userId])).rows[0].name;
    const entrant: Entrant = { userId, name, units, abilities: [...catalog.abilities] };
    await client.query('INSERT INTO multiplayer_entries(user_id,connection_id,data) VALUES($1,$2,$3)', [userId, connectionId, JSON.stringify(entrant)]);
    const queue = (await client.query<Entry>('SELECT * FROM multiplayer_entries WHERE match_id IS NULL ORDER BY position LIMIT 2')).rows;
    if (queue.length < 2) return [{ userId, view: { phase: 'queued' } }];
    if (this.randomIndex(2) === 1) queue.reverse();
    const id = randomUUID();
    const match: Match = {
      id, phase: 'preparing', sequence: 0, draftRevision: 0, createdAt: this.now(), startedAt: this.now(), rounds: 1, totalTurns: 0,
      players: queue.map((entry) => ({ userId: entry.user_id, name: entry.data.name, connectionId: entry.connection_id,
        ready: false, disconnectedAt: null, team: entry.data.units.map((unit) => unit.id) })) as Match['players'],
      battle: { id, encounterId: null, revision: 0, state: createBattle(queue[0].data.units, queue[1].data.units, queue[0].data.abilities),
        combo: { side: 'player', actions: [] }, turnDeadlineAt: null, botActsAt: null, log: [] },
    };
    await client.query('INSERT INTO multiplayer_matches(id,player_id,enemy_id,data) VALUES($1,$2,$3,$4)', [id, match.players[0].userId, match.players[1].userId, JSON.stringify(match)]);
    await client.query('UPDATE multiplayer_entries SET match_id=$1 WHERE user_id=ANY($2::uuid[])', [id, match.players.map((p) => p.userId)]);
    return this.views(match);
  }

  private turn(match: Match, expired: boolean) {
    const previousSide = match.battle.state.activeSide;
    const outcome = executeTurn(match.battle.state, expired ? [] : match.battle.combo?.actions ?? []);
    match.totalTurns++;
    if (outcome.state.status === 'active' && previousSide === 'enemy' && outcome.state.activeSide === 'player') match.rounds++;
    match.battle = { ...match.battle, state: outcome.state, revision: match.battle.revision + 1,
      combo: { side: outcome.state.activeSide, actions: [] },
      log: [...(match.battle.log ?? []), ...(expired ? [{ kind: 'turn' as const, message: 'Tempo de 45 segundos esgotado. Turno encerrado automaticamente.' }] : []), ...outcome.events],
      turnDeadlineAt: outcome.state.status === 'active' ? new Date(this.now() + TURN_DURATION_MS).toISOString() : null };
    match.draftRevision++;
  }

  private async advance(client: PoolClient, match: Match): Promise<MultiplayerUpdate[] | null> {
    const disconnected = match.players.map((p) => p.disconnectedAt);
    if (this.now() - match.createdAt >= MAX_MATCH_MS) return this.finish(client, match, null, 'void');
    if (disconnected.some((at) => at !== null && this.now() - at >= DISCONNECT_MS)) {
      if (match.phase === 'preparing' || disconnected.every((at) => at !== null)) return this.finish(client, match, null, 'void');
      return this.finish(client, match, disconnected[0] === null ? 0 : 1, 'disconnect');
    }
    if (match.phase === 'preparing' && this.now() - match.createdAt >= PREPARE_MS) {
      // Preparation never grants a competitive win; connected ready players can search again.
      return this.finish(client, match, null, 'void');
    }
    if (match.phase === 'active' && Date.parse(match.battle.turnDeadlineAt!) <= this.now()) {
      this.turn(match, true); match.sequence++;
      if (match.battle.state.status !== 'active') return this.finish(client, match, match.battle.state.status === 'victory' ? 0 : 1, 'combat');
      await this.save(client, match);
      return this.views(match);
    }
    return null;
  }

  private async finish(client: PoolClient, match: Match, winner: number | null, reason: MultiplayerResult['reason']) {
    const winnerId = winner === null ? null : match.players[winner].userId;
    const loserId = winner === null ? null : match.players[1 - winner].userId;
    const result: MultiplayerResult = { id: match.id, participantIds: match.players.map((p) => p.userId) as [string, string], winnerId, loserId,
      teams: Object.fromEntries(match.players.map((p) => [p.userId, p.team])), startedAt: new Date(match.startedAt).toISOString(),
      noDeathsByUserId: Object.fromEntries(match.players.map((p, i) => [p.userId,
        match.battle.state.teams[i === 0 ? 'player' : 'enemy'].units.every((u) => u.hp > 0 && u.wasDefeated === false)])),
      completedAt: new Date(this.now()).toISOString(), rounds: match.rounds, totalTurns: match.totalTurns, reason };
    const progresses = await client.query<{ user_id: string; data: PlayerProgress }>('SELECT user_id,data FROM player_progress WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE', [result.participantIds]);
    await client.query('INSERT INTO multiplayer_results(id,player_id,enemy_id,winner_id,loser_id,completed_at,data) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [match.id, ...result.participantIds, winnerId, loserId, result.completedAt, JSON.stringify(result)]);
    if (winnerId) {
      const progress = progresses.rows.find((p) => p.user_id === winnerId);
      if (progress) await synchronizeCharacterUnlocks(client, winnerId, progress.data);
    }
    await client.query('DELETE FROM multiplayer_matches WHERE id=$1', [match.id]);
    match.sequence++;
    match.battle.turnDeadlineAt = null;
    match.battle.combo = null;
    match.battle.state.status = winner === null ? 'abandoned' : winner === 0 ? 'victory' : 'defeat';
    return this.views(match, result);
  }

  async tick() {
    return this.transaction(async (client) => {
      const rows = (await client.query<{ data: Match }>('SELECT data FROM multiplayer_matches ORDER BY id FOR UPDATE')).rows;
      const updates: MultiplayerUpdate[] = [];
      for (const row of rows) updates.push(...(await this.advance(client, row.data) ?? []));
      return updates;
    });
  }

  async initialize() {
    return this.transaction(async (client) => {
      const rows = (await client.query<{ data: Match }>('SELECT data FROM multiplayer_matches ORDER BY id FOR UPDATE')).rows;
      const updates: MultiplayerUpdate[] = [];
      for (const row of rows) updates.push(...await this.finish(client, row.data, null, 'void'));
      await client.query('DELETE FROM multiplayer_entries');
      return updates;
    });
  }
}
