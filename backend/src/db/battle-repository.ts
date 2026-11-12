import { randomInt, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { CampaignBattleOptions, CampaignMapData, PlayerProgress, QuickBattleData } from '@game/contracts.js';
import type { EncounterDefinition } from '@game/content/encounters.js';
import { FINAL_ENCOUNTER_ID, FINAL_BATTLE_REQUIREMENT, SECOND_FINAL_ENCOUNTER_ID, OSIRIS_UNIT_ID,
  OSIRIS_BATTLE_REQUIREMENT, withOsiris } from '@game/content/campaign-rules.js';
import { QUICK_BATTLE_ALWAYS_UNIT_IDS, QUICK_BATTLE_MISSION_OPPONENT_UNIT_IDS, type UnitDefinition } from '@game/content/units.js';
import { BOT_THINK_MS, TURN_DURATION_MS, createBattle, executeTurn, planEnemyTurn, type BattleAction, type BattleCombo, type BattleRecord, type BattleTurnResult, type BattleEvent } from '@game/core/battle.js';
import type { BattleRepository } from '../game/battle-repository.js';
import { GameError } from '../game/repository.js';
import { PostgresGameRepository, readTeam } from './game-repository.js';
import { synchronizeCharacterUnlocks } from './character-unlocks.js';
import type { UnlockBattleMode } from '@game/content/unlocks.js';

const encounterQuery = `SELECT e.id, e.campaign_id AS "campaignId", e.position, e.title, e.story,
  e.map_x::float AS "mapX", e.map_y::float AS "mapY",
  ARRAY(SELECT unit_id FROM encounter_enemies WHERE encounter_id = e.id ORDER BY slot_index) AS "enemyUnitIds" FROM encounters e`;
const initialLog = (): BattleEvent[] => [{ kind: 'turn', message: 'Batalha iniciada. Sua equipe começa o turno 1 com 15 de energia.' }];
const recordColumns = `id, encounter_id AS "encounterId", revision, state, log, combo,
  to_char(turn_deadline_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "turnDeadlineAt",
  to_char(bot_acts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "botActsAt"`;
type BattleMode = 'campaign' | UnlockBattleMode;

export class PostgresBattleRepository implements BattleRepository {
  constructor(private readonly pool: Pool, private readonly randomIndex: (maximum: number) => number = randomInt,
    private readonly now: () => number = Date.now) {}

  async getMap(userId: string, campaignId: string): Promise<CampaignMapData> {
    const campaign = (await new PostgresGameRepository(this.pool).getCampaigns(userId)).find((entry) => entry.id === campaignId);
    if (!campaign) throw new GameError(404, 'Campanha não encontrada.');
    if (!campaign.available) throw new GameError(403, 'Esta campanha está bloqueada.');
    const progress = await this.pool.query<{ data: PlayerProgress }>('SELECT data FROM player_progress WHERE user_id = $1', [userId]);
    const completed = new Set(progress.rows[0].data.completedEncounters);
    const definitions = await this.pool.query<EncounterDefinition>(`${encounterQuery} WHERE e.campaign_id = $1 ORDER BY e.position`, [campaignId]);
    return { campaign, encounters: definitions.rows.map((entry) => ({ ...entry,
      completed: completed.has(entry.id),
      available: definitions.rows.filter((previous) => previous.position < entry.position).every((previous) => completed.has(previous.id)),
      activeBattleId: null,
    })) };
  }

  async getBattle(userId: string, battleId: string): Promise<BattleRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const progress = await this.lockProgress(client, userId);
      const result = await client.query<BattleRecord & { mode: BattleMode }>(`SELECT ${recordColumns}, mode FROM battles WHERE id = $1 AND user_id = $2 FOR UPDATE`, [battleId, userId]);
      if (!result.rows[0]) throw new GameError(404, 'Batalha não encontrada.');
      const { mode, ...battle } = result.rows[0];
      const updated = await this.advanceDueTurn(client, userId, progress, battle, mode);
      await client.query('COMMIT');
      return updated;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private clocks(state: BattleRecord['state'], mode: BattleMode) {
    return {
      turnDeadlineAt: state.status === 'active' ? new Date(this.now() + TURN_DURATION_MS).toISOString() : null,
      botActsAt: state.status === 'active' && state.activeSide === 'enemy' && mode !== 'multiplayer'
        ? new Date(this.now() + BOT_THINK_MS).toISOString() : null,
    };
  }

  private nextCombo(state: BattleRecord['state'], mode: BattleMode): BattleCombo | null {
    if (state.status !== 'active') return null;
    return { side: state.activeSide, actions: state.activeSide === 'enemy' && mode !== 'multiplayer'
      ? planEnemyTurn(state) : [] };
  }

  private async saveOutcome(client: PoolClient, userId: string, progress: PlayerProgress, battle: BattleRecord, mode: BattleMode,
    outcome: ReturnType<typeof executeTurn>): Promise<BattleRecord> {
    const updated: BattleRecord = { ...battle, state: outcome.state, revision: battle.revision + 1,
      log: [...(battle.log ?? []), ...outcome.events], combo: this.nextCombo(outcome.state, mode),
      ...this.clocks(outcome.state, mode) };
    await client.query(`UPDATE battles SET state = $2, status = $3, revision = $4, log = $5, combo = $6,
      turn_deadline_at = $7, bot_acts_at = $8, updated_at = clock_timestamp() WHERE id = $1`,
      [battle.id, JSON.stringify(updated.state), updated.state.status, updated.revision, JSON.stringify(updated.log),
        updated.combo ? JSON.stringify(updated.combo) : null, updated.turnDeadlineAt, updated.botActsAt]);
    let savedProgress = progress;
    if (updated.state.status === 'victory' && battle.encounterId !== null) {
      const data = { ...progress,
        completedEncounters: [...new Set([...progress.completedEncounters, battle.encounterId])],
        availablePathIds: battle.encounterId === FINAL_ENCOUNTER_ID
          ? [...new Set([...progress.availablePathIds, 'path-2'])] : progress.availablePathIds,
      };
      savedProgress = data;
      await client.query('UPDATE player_progress SET data = $2, revision = revision + 1, updated_at = now() WHERE user_id = $1', [userId, JSON.stringify(data)]);
    }
    if (updated.state.status === 'victory') await synchronizeCharacterUnlocks(client, userId, savedProgress);
    return updated;
  }

  private async advanceDueTurn(client: PoolClient, userId: string, progress: PlayerProgress, battle: BattleRecord, mode: BattleMode) {
    if (battle.state.status !== 'active') return battle;
    const bot = battle.state.activeSide === 'enemy' && mode !== 'multiplayer';
    const expired = !!battle.turnDeadlineAt && Date.parse(battle.turnDeadlineAt) <= this.now();
    const botReady = bot && !!battle.botActsAt && Date.parse(battle.botActsAt) <= this.now();
    if (!expired && !botReady) return battle;
    const actions = bot ? (battle.combo?.side === 'enemy' ? battle.combo.actions : planEnemyTurn(battle.state)) : [];
    const outcome = executeTurn(battle.state, actions);
    if (!bot) outcome.events.unshift({ kind: 'turn', message: 'Tempo de 45 segundos esgotado. Turno encerrado automaticamente.' });
    return this.saveOutcome(client, userId, progress, battle, mode, outcome);
  }

  async processDueBattles(): Promise<void> {
    const due = await this.pool.query<{ id: string; user_id: string }>(`SELECT id, user_id FROM battles WHERE status = 'active'
      AND (turn_deadline_at <= $1 OR bot_acts_at <= $1) ORDER BY turn_deadline_at LIMIT 100`, [new Date(this.now())]);
    for (const battle of due.rows) {
      try { await this.getBattle(battle.user_id, battle.id); }
      catch (error) { if (!(error instanceof GameError && error.statusCode === 404)) throw error; }
    }
  }

  private async lockProgress(client: PoolClient, userId: string) {
    const result = await client.query<{ data: PlayerProgress }>('SELECT data FROM player_progress WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!result.rows[0]) throw new GameError(404, 'Progresso não encontrado.');
    return result.rows[0].data;
  }

  private async closeActiveBattles(client: PoolClient, userId: string) {
    await client.query(`UPDATE battles SET status = 'abandoned', state = jsonb_set(state, '{status}', '"abandoned"'),
      combo = NULL, turn_deadline_at = NULL, bot_acts_at = NULL, revision = revision + 1, updated_at = now(),
      log = log || '[{"kind":"result","message":"Batalha encerrada ao iniciar uma nova partida."}]'::jsonb
      WHERE user_id = $1 AND status = 'active'`, [userId]);
  }

  async abandonBattle(userId: string, battleId: string): Promise<BattleRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockProgress(client, userId);
      const found = await client.query<BattleRecord>(`SELECT ${recordColumns} FROM battles WHERE id = $1 AND user_id = $2 FOR UPDATE`, [battleId, userId]);
      const battle = found.rows[0];
      if (!battle) throw new GameError(404, 'Batalha não encontrada.');
      if (battle.state.status === 'abandoned') { await client.query('COMMIT'); return battle; }
      if (battle.state.status !== 'active') throw new GameError(409, 'Esta batalha já terminou.');
      const updated: BattleRecord = { ...battle, revision: battle.revision + 1,
        state: { ...battle.state, status: 'abandoned' }, combo: null, turnDeadlineAt: null, botActsAt: null,
        log: [...(battle.log ?? []), { kind: 'result', message: 'Batalha encerrada por desistência.' }] };
      await client.query(`UPDATE battles SET state = $2, status = 'abandoned', revision = $3, log = $4, combo = NULL,
        turn_deadline_at = NULL, bot_acts_at = NULL, updated_at = now() WHERE id = $1`,
        [battleId, JSON.stringify(updated.state), updated.revision, JSON.stringify(updated.log)]);
      await client.query('COMMIT');
      return updated;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private async playerTeam(client: PoolClient, userId: string, progress: PlayerProgress) {
    const team = (await readTeam(client, userId)).filter((id): id is string => id !== null);
    if (!team.length || team.length > 3 || new Set(team).size !== team.length) throw new GameError(400, 'Escolha de um a três personagens para sua equipe antes de iniciar.');
    if (team.some((id) => !progress.unlockedUnitIds.includes(id))) throw new GameError(403, 'A equipe contém um personagem bloqueado.');
    return team;
  }

  private async quickBattleOpponents(client: Pool | PoolClient, completedEncounters: readonly string[],
    unlockedUnitIds: readonly string[]) {
    const missionOpponents = QUICK_BATTLE_MISSION_OPPONENT_UNIT_IDS.filter((id) => unlockedUnitIds.includes(id));
    const opponents = await client.query<QuickBattleData['opponents'][number]>(`SELECT u.id, u.name, u.portrait_path AS portrait
      FROM units u WHERE (u.id = ANY($2::text[]) OR u.id = ANY($3::text[]) OR EXISTS (SELECT 1 FROM encounter_enemies e
          WHERE e.unit_id = u.id AND e.encounter_id = ANY($1::text[])))
      ORDER BY u.roster_order NULLS LAST, u.id`, [completedEncounters, QUICK_BATTLE_ALWAYS_UNIT_IDS,
        missionOpponents]);
    return opponents.rows;
  }

  async getQuickBattle(userId: string): Promise<QuickBattleData> {
    const progress = await this.pool.query<{ data: PlayerProgress }>('SELECT data FROM player_progress WHERE user_id = $1', [userId]);
    if (!progress.rows[0]) throw new GameError(404, 'Progresso não encontrado.');
    return { opponents: await this.quickBattleOpponents(this.pool, progress.rows[0].data.completedEncounters,
      progress.rows[0].data.unlockedUnitIds) };
  }

  async startQuickBattle(userId: string): Promise<BattleRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const progress = await this.lockProgress(client, userId);
      const opponents = await this.quickBattleOpponents(client, progress.completedEncounters, progress.unlockedUnitIds);
      if (!opponents.length) throw new GameError(503, 'Adversários indisponíveis no catálogo.');
      const team = await this.playerTeam(client, userId, progress);
      const catalog = await new PostgresGameRepository(this.pool).getCatalog(client);
      const findUnit = (id: string): UnitDefinition => {
        const unit = catalog.units.find((entry) => entry.id === id);
        if (!unit) throw new GameError(503, 'Unidade indisponível no catálogo.');
        return unit;
      };
      const remaining = opponents.map((unit) => unit.id);
      const enemies = Array.from({ length: Math.min(3, remaining.length) }, () =>
        findUnit(remaining.splice(this.randomIndex(remaining.length), 1)[0]));
      const battle: BattleRecord = { id: randomUUID(), encounterId: null, revision: 0, log: initialLog(),
        combo: { side: 'player', actions: [] }, state: createBattle(team.map(findUnit), enemies, catalog.abilities) };
      Object.assign(battle, this.clocks(battle.state, 'quick'));
      await this.closeActiveBattles(client, userId);
      await client.query("INSERT INTO battles (id, user_id, encounter_id, state, status, mode, log, combo, turn_deadline_at) VALUES ($1,$2,NULL,$3,$4,'quick',$5,$6,$7)",
        [battle.id, userId, JSON.stringify(battle.state), battle.state.status, JSON.stringify(battle.log),
          JSON.stringify(battle.combo), battle.turnDeadlineAt]);
      await client.query('COMMIT');
      return battle;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async startBattle(userId: string, encounterId: string, options: CampaignBattleOptions = {}): Promise<BattleRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const progress = await this.lockProgress(client, userId);
      const result = await client.query<EncounterDefinition>(`${encounterQuery} WHERE e.id = $1`, [encounterId]);
      const encounter = result.rows[0];
      if (!encounter) throw new GameError(404, 'Encontro não encontrado.');
      const campaign = await client.query<{ released: boolean; prerequisite: string | null }>('SELECT released, prerequisite_encounter_id AS prerequisite FROM campaigns WHERE id = $1', [encounter.campaignId]);
      const gate = campaign.rows[0]?.prerequisite;
      const available = !gate || progress.completedEncounters.includes(gate);
      if (!campaign.rows[0]?.released || !available) throw new GameError(403, 'Esta campanha está bloqueada.');
      const previous = await client.query<{ id: string }>('SELECT id FROM encounters WHERE campaign_id = $1 AND position < $2', [encounter.campaignId, encounter.position]);
      if (previous.rows.some((entry) => !progress.completedEncounters.includes(entry.id))) throw new GameError(403, 'Vença as batalhas anteriores para liberar este encontro.');
      const osirisBattle = encounter.id === SECOND_FINAL_ENCOUNTER_ID;
      if (osirisBattle && ![0, 1, 2].includes(options.osirisSlot as number)) throw new GameError(400, OSIRIS_BATTLE_REQUIREMENT);
      if (!osirisBattle && options.osirisSlot !== undefined) throw new GameError(400, 'Osiris só é convidado para a batalha final da segunda campanha.');
      const guestSlots = osirisBattle ? withOsiris(await readTeam(client, userId), options.osirisSlot!) : null;
      const selectedTeam = guestSlots ? guestSlots.filter((id): id is string => id !== null) : await this.playerTeam(client, userId, progress);
      if (guestSlots && selectedTeam.some((id) => id !== OSIRIS_UNIT_ID && !progress.unlockedUnitIds.includes(id))) {
        throw new GameError(403, 'A equipe contém um personagem bloqueado.');
      }
      const finalBattle = encounter.id === FINAL_ENCOUNTER_ID;
      if (finalBattle && !selectedTeam.includes('protagonist-main-base')) throw new GameError(400, FINAL_BATTLE_REQUIREMENT);
      const team = selectedTeam;
      const catalog = await new PostgresGameRepository(this.pool).getCatalog(client);
      const findUnit = (id: string): UnitDefinition => {
        const unit = catalog.units.find((entry) => entry.id === id);
        if (!unit) throw new GameError(400, 'Unidade inválida no encontro.');
        return unit;
      };
      if (encounter.enemyUnitIds.length < 1 || encounter.enemyUnitIds.length > 3) throw new GameError(503, 'Este encontro precisa de um a três inimigos cadastrados.');
      const battle: BattleRecord = { id: randomUUID(), encounterId, revision: 0, log: initialLog(),
        combo: { side: 'player', actions: [] }, state: createBattle(team.map(findUnit), encounter.enemyUnitIds.map(findUnit), catalog.abilities) };
      if (guestSlots) {
        const occupied = guestSlots.flatMap((id, slot) => id ? [slot] : []);
        battle.state.teams.player.units.forEach((unit, index) => { unit.id = `player-${occupied[index]}`; });
        battle.log!.push({ kind: 'turn', message: `Grande rei Osiris ocupa o slot ${options.osirisSlot! + 1} como aliado convidado.` });
      }
      if (finalBattle) {
        const { id, name, portrait, maxHp, abilityIds } = findUnit('protagonist-main-transformed');
        const ravi = battle.state.teams.player.units.find((unit) => unit.unitId === 'protagonist-main-base')!;
        const previousName = ravi.name;
        Object.assign(ravi, { unitId: id, name, portrait, maxHp, hp: maxHp, abilityIds: [...abilityIds] });
        battle.log!.push({ kind: 'transform', actorId: ravi.id, targetIds: [ravi.id], message: `${previousName} despertou como ${name}!` });
      }
      Object.assign(battle, this.clocks(battle.state, 'campaign'));
      await this.closeActiveBattles(client, userId);
      await client.query('INSERT INTO battles (id, user_id, encounter_id, state, status, log, combo, turn_deadline_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [battle.id, userId, encounterId, JSON.stringify(battle.state), battle.state.status, JSON.stringify(battle.log),
          JSON.stringify(battle.combo), battle.turnDeadlineAt]);
      await client.query('COMMIT');
      return battle;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async submitTurn(userId: string, battleId: string, revision: number, requestId: string, actions: BattleAction[]): Promise<BattleTurnResult> {
    const client = await this.pool.connect();
    let committed = false;
    try {
      await client.query('BEGIN');
      const progress = await this.lockProgress(client, userId);
      const row = await client.query<BattleRecord & { mode: BattleMode }>(`SELECT ${recordColumns}, mode FROM battles WHERE id = $1 AND user_id = $2 FOR UPDATE`, [battleId, userId]);
      if (!row.rows[0]) throw new GameError(404, 'Batalha não encontrada.');
      const { mode, ...battle } = row.rows[0];
      const duplicate = await client.query<{ response: BattleTurnResult }>('SELECT response FROM battle_commands WHERE battle_id = $1 AND request_id = $2', [battleId, requestId]);
      if (duplicate.rows[0]) { await client.query('COMMIT'); return duplicate.rows[0].response; }
      if (battle.revision !== revision) throw new GameError(409, 'O turno já mudou. Atualize a batalha para continuar.');
      const advanced = await this.advanceDueTurn(client, userId, progress, battle, mode);
      if (advanced.revision !== battle.revision) {
        await client.query('COMMIT');
        committed = true;
        throw new GameError(409, 'O prazo do turno terminou. A batalha foi atualizada automaticamente.');
      }
      if (battle.state.activeSide !== 'player') throw new GameError(409, 'Aguarde o turno da sua equipe.');
      const outcome = executeTurn(battle.state, actions);
      const updated = await this.saveOutcome(client, userId, progress, battle, mode, outcome);
      const response: BattleTurnResult = { battle: updated, events: outcome.events };
      await client.query('INSERT INTO battle_commands (battle_id, request_id, response) VALUES ($1,$2,$3)', [battleId, requestId, JSON.stringify(response)]);
      await client.query('COMMIT');
      return response;
    } catch (error) { if (!committed) await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
